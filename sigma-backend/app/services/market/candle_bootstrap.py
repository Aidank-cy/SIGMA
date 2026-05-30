"""Cold-start helpers for market candle refreshes."""

import logging

from app.services.market.config import IndexConfig

LOGGER = logging.getLogger(__name__)


async def _cold_start_fetch(config: IndexConfig, status: str) -> None:
    from app.services.market import candles

    symbol = config.symbol
    last = candles._last_fetch_time.get(symbol)
    now_utc = candles._now_utc()
    if last is not None and (now_utc - last).total_seconds() < candles.COLD_START_NOT_OPEN_DELAY:
        return

    if status == "trading":
        await candles._cold_start_next_piece(config, backfill_intraday_gap=True)
        candles._last_fetch_time[symbol] = candles._now_utc()
        return

    await candles._cold_start_next_piece(config)
    candles._last_fetch_time[symbol] = candles._now_utc()


async def _cold_start_next_piece(config: IndexConfig, backfill_intraday_gap: bool = True) -> None:
    from app.services.market import candles

    symbol = config.symbol

    if not await candles._redis_has_fresh_1d(config):
        if candles._cold_start_step_exceeded(symbol, "1D"):
            LOGGER.warning(
                "Skipping 1D cold start for %s after %d failed attempts.",
                symbol,
                candles._MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            candles._cold_start_step_attempt(symbol, "1D")
            stored_count = await candles._fetch_and_store_1d_1min(
                config, backfill_intraday_gap=backfill_intraday_gap
            )
            if stored_count:
                candles._cold_start_step_reset(symbol, "1D")
                LOGGER.info(
                    "Cold start piece: %s 1D 1min to Redis (%d points)", symbol, stored_count
                )
            return

    if not await candles._redis_has_fresh_5d(config):
        if candles._cold_start_step_exceeded(symbol, "5D"):
            LOGGER.warning(
                "Skipping 5D cold start for %s after %d failed attempts.",
                symbol,
                candles._MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            candles._cold_start_step_attempt(symbol, "5D")
            one_min = await candles._yahoo_fetch(config, interval="1m", range_="5d")
            if one_min:
                candles._cold_start_step_reset(symbol, "5D")
                await candles._redis_set_5d(symbol, one_min)
                today_points = candles._filter_today(config, one_min)
                if today_points:
                    await candles._redis_set_1d(symbol, today_points)
                LOGGER.info("Cold start piece: %s 5D 1min to Redis", symbol)
            return

    if not await candles._pg_has_interval(symbol, "15m"):
        if candles._cold_start_step_exceeded(symbol, "15m"):
            LOGGER.warning(
                "Skipping 15m cold start for %s after %d failed attempts.",
                symbol,
                candles._MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            candles._cold_start_step_attempt(symbol, "15m")
            fifteen = await candles._yahoo_fetch(config, interval="15m", range_="1mo")
            if fifteen:
                candles._cold_start_step_reset(symbol, "15m")
                await candles._pg_upsert_candles(symbol, "15m", fifteen)
                LOGGER.info("Cold start piece: %s 1M 15min to PG", symbol)
            return

    if not await candles._pg_has_interval(symbol, "60m"):
        if candles._cold_start_step_exceeded(symbol, "60m"):
            LOGGER.warning(
                "Skipping 60m cold start for %s after %d failed attempts.",
                symbol,
                candles._MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            candles._cold_start_step_attempt(symbol, "60m")
            hourly = await candles._yahoo_fetch(config, interval="60m", range_="1y")
            if hourly:
                candles._cold_start_step_reset(symbol, "60m")
                await candles._pg_upsert_candles(symbol, "60m", hourly)
                LOGGER.info("Cold start piece: %s 1Y 60min to PG", symbol)
            return

    has_1d = await candles._redis_has_fresh_1d(config)
    has_5d = await candles._redis_has_fresh_5d(config)
    has_pg = await candles._pg_has_interval(symbol, "15m") or await candles._pg_has_interval(
        symbol, "60m"
    )
    if has_1d or has_5d or has_pg:
        candles._cold_start_done[symbol] = True
        LOGGER.info("Cold start complete for %s", symbol)
        return

    candles._cold_start_step_reset_all(symbol)
    LOGGER.warning(
        "Cold start for %s completed all steps but stored no data. "
        "Resetting attempt counters to retry on next cycle.",
        symbol,
    )


def _cold_start_step_key(symbol: str, step: str) -> str:
    return f"{symbol}:{step}"


def _cold_start_step_attempt(symbol: str, step: str) -> int:
    from app.services.market import candles

    key = candles._cold_start_step_key(symbol, step)
    attempts = candles._cold_start_attempts.get(key, 0) + 1
    candles._cold_start_attempts[key] = attempts
    return attempts


def _cold_start_step_exceeded(symbol: str, step: str) -> bool:
    from app.services.market import candles

    return (
        candles._cold_start_attempts.get(candles._cold_start_step_key(symbol, step), 0)
        >= candles._MAX_COLD_START_ATTEMPTS_PER_STEP
    )


def _cold_start_step_reset(symbol: str, step: str) -> None:
    from app.services.market import candles

    candles._cold_start_attempts.pop(candles._cold_start_step_key(symbol, step), None)


def _cold_start_step_reset_all(symbol: str) -> None:
    from app.services.market import candles

    for step in ("1D", "5D", "15m", "60m"):
        candles._cold_start_step_reset(symbol, step)
