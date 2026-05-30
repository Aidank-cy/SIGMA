import asyncio
import json
import logging
import statistics
import time as _time
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy import func as sa_func

from app.database import AsyncSessionLocal
from app.models.market_candle import MarketCandle
from app.services.market_indices import (
    BEIJING_TZ,
    INDEX_CONFIGS,
    IndexConfig,
    IntradayPoint,
    _as_float,
    _elapsed_trading_minutes,
    _fetch_yahoo_chart_result,
    _is_trading,
    _is_within_session,
    _latest_session_date,
    _market_status_beijing,
    _now_utc,
)
from app.utils.redis_lock import create_redis_client

LOGGER = logging.getLogger(__name__)

CANDLE_1D_KEY = "sigma:candles:1d:{symbol}"
CANDLE_5D_KEY = "sigma:candles:5d:{symbol}"
CANDLE_1D_TTL = 60 * 60 * 24 * 4
CANDLE_5D_TTL = 60 * 60 * 24 * 7

TRADING_FETCH_INTERVAL = 10
COLD_START_NOT_OPEN_DELAY = 5
PRE_MARKET_WINDOW_MINUTES = 60
INTRADAY_GAP_MIN_EXPECTED_POINTS = 30
INTRADAY_GAP_MIN_COVERAGE_RATIO = 0.8
_MAX_COLD_START_ATTEMPTS_PER_STEP = 3
_DATA_HEALTH_CHECK_INTERVAL = 300
POST_CLOSE_RETRY_MINUTES = (1, 3)
POST_CLOSE_RETRY_WINDOW_MINUTES = 10
POST_CLOSE_REFETCH_WINDOW_MINUTES = (15, 20)

_last_fetch_time: dict[str, datetime] = {}
_cold_start_done: dict[str, bool] = {}
_cold_start_attempts: dict[str, int] = {}
_post_close_retry_slots: dict[str, tuple[date, set[int]]] = {}
_post_close_refetch_done: dict[str, date] = {}
_last_health_check = 0.0
_pg_integrity_checked = False


async def candle_refresh_job() -> None:
    """Refresh per-market candle storage without blocking quote refreshes."""
    global _last_health_check, _pg_integrity_checked
    if not _pg_integrity_checked:
        try:
            await _check_pg_candle_integrity()
        except Exception as exc:
            LOGGER.warning(
                "PostgreSQL candle integrity check failed: %s: %s", type(exc).__name__, exc
            )
        else:
            _pg_integrity_checked = True

    now_beijing = _now_utc().astimezone(BEIJING_TZ)
    _reset_post_close_refetch_done(now_beijing)

    cold_start_pending = [
        config for config in INDEX_CONFIGS if not _cold_start_done.get(config.symbol, False)
    ]
    if cold_start_pending:
        cold_start_pending.sort(
            key=lambda config: 0 if _market_status_beijing(config, now_beijing) == "trading" else 1
        )
        await asyncio.gather(
            *(
                _cold_start_fetch(config, _market_status_beijing(config, now_beijing))
                for config in cold_start_pending
            )
        )
    else:

        async def _process_market(config: IndexConfig) -> None:
            status = _market_status_beijing(config, now_beijing)

            if status == "trading":
                last = _last_fetch_time.get(config.symbol)
                now_utc = _now_utc()
                if last is not None and (now_utc - last).total_seconds() < TRADING_FETCH_INTERVAL:
                    return
                await _fetch_and_store_1d_1min(config)
                _last_fetch_time[config.symbol] = _now_utc()
                return

            if _is_pre_market(config, now_beijing):
                if await _redis_has_fresh_1d(config):
                    return
                await _fetch_and_store_1d_1min(config)
                _last_fetch_time[config.symbol] = _now_utc()
                return

            if status == "closed":
                if _post_close_refetch_due(config, now_beijing):
                    await _fetch_and_store_1d_1min(config, backfill_intraday_gap=True)
                    _post_close_refetch_done[config.symbol] = _post_close_refetch_date(
                        config, now_beijing
                    )
                    _last_fetch_time[config.symbol] = _now_utc()
                elif not await _redis_has_fresh_1d(config) or _post_close_retry_due(
                    config, now_beijing
                ):
                    await _fetch_and_store_1d_1min(config)
                    _last_fetch_time[config.symbol] = _now_utc()
                await _end_of_day_downsample_if_needed(config)
                return

        sorted_configs = sorted(
            INDEX_CONFIGS,
            key=lambda config: (
                0
                if _market_status_beijing(config, now_beijing) == "trading"
                else 1
                if _is_pre_market(config, now_beijing)
                else 2
            ),
        )
        await asyncio.gather(*(_process_market(config) for config in sorted_configs))

    now_mono = _time.monotonic()
    if now_mono - _last_health_check >= _DATA_HEALTH_CHECK_INTERVAL:
        _last_health_check = now_mono
        for config in INDEX_CONFIGS:
            if await _redis_has_fresh_1d(config):
                continue
            if _cold_start_done.get(config.symbol, False):
                LOGGER.warning(
                    "Health check: %s has no fresh 1D data. Resetting cold start.",
                    config.symbol,
                )
                _cold_start_done[config.symbol] = False
                _cold_start_step_reset_all(config.symbol)


def _is_pre_market(config: IndexConfig, now_beijing: datetime) -> bool:
    """Return True within the warm-up window before the first session opens."""
    local_now = now_beijing.astimezone(ZoneInfo(config.timezone))
    if local_now.weekday() >= 5:
        return False
    current = local_now.time()
    first_open = config.sessions[0][0]
    current_mins = current.hour * 60 + current.minute
    open_mins = first_open.hour * 60 + first_open.minute
    diff = open_mins - current_mins
    return 0 < diff <= PRE_MARKET_WINDOW_MINUTES


def _post_close_retry_due(config: IndexConfig, now_beijing: datetime) -> bool:
    local_now = now_beijing.astimezone(ZoneInfo(config.timezone))
    session_date = _latest_session_date(config, now_beijing)
    close_local = datetime.combine(
        session_date, config.close_time, tzinfo=ZoneInfo(config.timezone)
    )
    if config.close_time <= config.open_time:
        close_local += timedelta(days=1)

    minutes_after_close = int((local_now - close_local).total_seconds() // 60)
    if (
        minutes_after_close < POST_CLOSE_RETRY_MINUTES[0]
        or minutes_after_close > POST_CLOSE_RETRY_WINDOW_MINUTES
    ):
        return False

    stored_date, completed_slots = _post_close_retry_slots.get(config.symbol, (session_date, set()))
    if stored_date != session_date:
        completed_slots = set()

    for retry_minute in POST_CLOSE_RETRY_MINUTES:
        if minutes_after_close >= retry_minute and retry_minute not in completed_slots:
            completed_slots.add(retry_minute)
            _post_close_retry_slots[config.symbol] = (session_date, completed_slots)
            return True

    _post_close_retry_slots[config.symbol] = (session_date, completed_slots)
    return False


def _post_close_refetch_date(config: IndexConfig, now_beijing: datetime) -> date:
    return now_beijing.astimezone(ZoneInfo(config.timezone)).date()


def _reset_post_close_refetch_done(now_beijing: datetime) -> None:
    configs_by_symbol = {config.symbol: config for config in INDEX_CONFIGS}
    for symbol, completed_date in list(_post_close_refetch_done.items()):
        config = configs_by_symbol.get(symbol)
        if config is None or completed_date != _post_close_refetch_date(config, now_beijing):
            _post_close_refetch_done.pop(symbol, None)


def _minutes_since_last_session_close(config: IndexConfig, now_beijing: datetime) -> int | None:
    zone = ZoneInfo(config.timezone)
    local_now = now_beijing.astimezone(zone)
    session_date = _latest_session_date(config, now_beijing)
    close_local = datetime.combine(session_date, config.close_time, tzinfo=zone)
    if config.close_time <= config.open_time:
        close_local += timedelta(days=1)
    if local_now < close_local:
        return None
    return int((local_now - close_local).total_seconds() // 60)


def _post_close_refetch_due(config: IndexConfig, now_beijing: datetime) -> bool:
    refetch_date = _post_close_refetch_date(config, now_beijing)
    if _post_close_refetch_done.get(config.symbol) == refetch_date:
        return False

    minutes_since_close = _minutes_since_last_session_close(config, now_beijing)
    if minutes_since_close is None:
        return False

    min_minutes, max_minutes = POST_CLOSE_REFETCH_WINDOW_MINUTES
    return min_minutes <= minutes_since_close <= max_minutes


async def _cold_start_fetch(config: IndexConfig, status: str) -> None:
    symbol = config.symbol
    last = _last_fetch_time.get(symbol)
    now_utc = _now_utc()
    if last is not None and (now_utc - last).total_seconds() < COLD_START_NOT_OPEN_DELAY:
        return

    if status == "trading":
        await _cold_start_next_piece(config, backfill_intraday_gap=True)
        _last_fetch_time[symbol] = _now_utc()
        return

    await _cold_start_next_piece(config)
    _last_fetch_time[symbol] = _now_utc()


async def _cold_start_next_piece(config: IndexConfig, backfill_intraday_gap: bool = True) -> None:
    symbol = config.symbol

    if not await _redis_has_fresh_1d(config):
        if _cold_start_step_exceeded(symbol, "1D"):
            LOGGER.warning(
                "Skipping 1D cold start for %s after %d failed attempts.",
                symbol,
                _MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            _cold_start_step_attempt(symbol, "1D")
            stored_count = await _fetch_and_store_1d_1min(
                config, backfill_intraday_gap=backfill_intraday_gap
            )
            if stored_count:
                _cold_start_step_reset(symbol, "1D")
                LOGGER.info(
                    "Cold start piece: %s 1D 1min to Redis (%d points)", symbol, stored_count
                )
            return

    if not await _redis_has_fresh_5d(config):
        if _cold_start_step_exceeded(symbol, "5D"):
            LOGGER.warning(
                "Skipping 5D cold start for %s after %d failed attempts.",
                symbol,
                _MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            _cold_start_step_attempt(symbol, "5D")
            one_min = await _yahoo_fetch(config, interval="1m", range_="5d")
            if one_min:
                _cold_start_step_reset(symbol, "5D")
                await _redis_set_5d(symbol, one_min)
                today_points = _filter_today(config, one_min)
                if today_points:
                    await _redis_set_1d(symbol, today_points)
                LOGGER.info("Cold start piece: %s 5D 1min to Redis", symbol)
            return

    if not await _pg_has_interval(symbol, "15m"):
        if _cold_start_step_exceeded(symbol, "15m"):
            LOGGER.warning(
                "Skipping 15m cold start for %s after %d failed attempts.",
                symbol,
                _MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            _cold_start_step_attempt(symbol, "15m")
            fifteen = await _yahoo_fetch(config, interval="15m", range_="1mo")
            if fifteen:
                _cold_start_step_reset(symbol, "15m")
                await _pg_upsert_candles(symbol, "15m", fifteen)
                LOGGER.info("Cold start piece: %s 1M 15min to PG", symbol)
            return

    if not await _pg_has_interval(symbol, "60m"):
        if _cold_start_step_exceeded(symbol, "60m"):
            LOGGER.warning(
                "Skipping 60m cold start for %s after %d failed attempts.",
                symbol,
                _MAX_COLD_START_ATTEMPTS_PER_STEP,
            )
        else:
            _cold_start_step_attempt(symbol, "60m")
            hourly = await _yahoo_fetch(config, interval="60m", range_="1y")
            if hourly:
                _cold_start_step_reset(symbol, "60m")
                await _pg_upsert_candles(symbol, "60m", hourly)
                LOGGER.info("Cold start piece: %s 1Y 60min to PG", symbol)
            return

    has_1d = await _redis_has_fresh_1d(config)
    has_5d = await _redis_has_fresh_5d(config)
    has_pg = await _pg_has_interval(symbol, "15m") or await _pg_has_interval(symbol, "60m")
    if has_1d or has_5d or has_pg:
        _cold_start_done[symbol] = True
        LOGGER.info("Cold start complete for %s", symbol)
        return

    _cold_start_step_reset_all(symbol)
    LOGGER.warning(
        "Cold start for %s completed all steps but stored no data. "
        "Resetting attempt counters to retry on next cycle.",
        symbol,
    )


def _cold_start_step_key(symbol: str, step: str) -> str:
    return f"{symbol}:{step}"


def _cold_start_step_attempt(symbol: str, step: str) -> int:
    key = _cold_start_step_key(symbol, step)
    attempts = _cold_start_attempts.get(key, 0) + 1
    _cold_start_attempts[key] = attempts
    return attempts


def _cold_start_step_exceeded(symbol: str, step: str) -> bool:
    return (
        _cold_start_attempts.get(_cold_start_step_key(symbol, step), 0)
        >= _MAX_COLD_START_ATTEMPTS_PER_STEP
    )


def _cold_start_step_reset(symbol: str, step: str) -> None:
    _cold_start_attempts.pop(_cold_start_step_key(symbol, step), None)


def _cold_start_step_reset_all(symbol: str) -> None:
    for step in ("1D", "5D", "15m", "60m"):
        _cold_start_step_reset(symbol, step)


async def _fetch_and_store_1d_1min(config: IndexConfig, backfill_intraday_gap: bool = True) -> int:
    points = await _yahoo_fetch(config, interval="1m", range_="1d")
    if not points:
        return 0

    if not _candles_are_reasonable(config, points):
        return 0

    stored_points = points
    if backfill_intraday_gap and _has_intraday_gap(config, points):
        five_day = await _yahoo_fetch(config, interval="1m", range_="5d")
        if five_day:
            today_points = _filter_today(config, five_day)
            if len(today_points) > len(points):
                stored_points = today_points
                LOGGER.info(
                    "Backfilled %s 1D candles from Yahoo 5D data after sparse 1D fetch: "
                    "%d -> %d points",
                    config.symbol,
                    len(points),
                    len(today_points),
                )

    stored_points = _dedupe_points_by_timestamp(stored_points)
    if not _candles_are_reasonable(config, stored_points):
        return 0

    await _redis_set_1d(config.symbol, stored_points)
    return len(stored_points)


def _dedupe_points_by_timestamp(points: list[IntradayPoint]) -> list[IntradayPoint]:
    points_by_timestamp: dict[int, IntradayPoint] = {}
    for point in points:
        points_by_timestamp[int(point.timestamp.timestamp())] = point
    return sorted(points_by_timestamp.values(), key=lambda point: point.timestamp)


def _candles_are_reasonable(config: IndexConfig, points: list[IntradayPoint]) -> bool:
    if config.fallback_value <= 0 or not points:
        return True
    median_candle = statistics.median(point.value for point in points)
    ratio = median_candle / config.fallback_value
    if ratio > 1.8 or ratio < 0.2:
        LOGGER.warning(
            "Discarding suspicious candle data for %s: median=%.2f vs expected ~%.2f (ratio=%.2f)",
            config.symbol,
            median_candle,
            config.fallback_value,
            ratio,
        )
        return False
    return True


def _has_intraday_gap(
    config: IndexConfig,
    points: list[IntradayPoint],
    coverage_ratio: float = INTRADAY_GAP_MIN_COVERAGE_RATIO,
) -> bool:
    now = _now_utc()
    session_date = _latest_session_date(config, now)
    zone = ZoneInfo(config.timezone)
    todays_points = [
        point for point in points if point.timestamp.astimezone(zone).date() == session_date
    ]

    if _is_trading(config, now):
        expected_count = len(_elapsed_trading_minutes(config, session_date, now))
    else:
        expected_count = len(_elapsed_trading_minutes(config, session_date))

    if expected_count < INTRADAY_GAP_MIN_EXPECTED_POINTS:
        return False

    return len(todays_points) < expected_count * coverage_ratio


async def _end_of_day_downsample_if_needed(config: IndexConfig) -> None:
    symbol = config.symbol
    today_1min = await _redis_get_1d(symbol)
    if not today_1min or len(today_1min) < 10:
        return
    candle_date = today_1min[-1].timestamp.astimezone(BEIJING_TZ).date()
    if await _pg_has_date(symbol, "60m", candle_date):
        return

    fifteen_min = _downsample(today_1min, minutes=15)
    await _pg_upsert_candles(symbol, "15m", fifteen_min)

    sixty_min = _downsample(today_1min, minutes=60)
    await _pg_upsert_candles(symbol, "60m", sixty_min)

    existing_5d = await _redis_get_5d(symbol) or []
    trimmed = _trim_to_n_trading_days(config, [*existing_5d, *today_1min], n=5)
    await _redis_set_5d(symbol, trimmed)
    await _pg_delete_older_than_1y(symbol)

    LOGGER.info(
        "End-of-day downsample complete for %s: %d 15m candles, %d 60m candles",
        symbol,
        len(fifteen_min),
        len(sixty_min),
    )


async def _yahoo_fetch(
    config: IndexConfig, interval: str, range_: str
) -> list[IntradayPoint] | None:
    result = await _fetch_yahoo_chart_result(
        config,
        params={"includePrePost": "false", "interval": interval, "range": range_},
        purpose=f"candles {interval} {range_}",
    )
    if not isinstance(result, dict):
        return None
    timestamps = result.get("timestamp")
    indicators = result.get("indicators", {})
    if not isinstance(timestamps, list) or not isinstance(indicators, dict):
        return None
    quote_payload = indicators.get("quote", [None])[0]
    if not isinstance(quote_payload, dict):
        return None
    closes = quote_payload.get("close")
    if not isinstance(closes, list) or len(closes) != len(timestamps):
        return None

    points: list[IntradayPoint] = []
    for timestamp, close in zip(timestamps, closes, strict=False):
        value = _as_float(close)
        epoch = _as_float(timestamp)
        if value is None or epoch is None or value <= 0:
            continue
        point = IntradayPoint(
            timestamp=datetime.fromtimestamp(epoch, tz=UTC).astimezone(BEIJING_TZ),
            value=value,
        )
        if interval != "1m" or _is_within_session(point.timestamp, config):
            points.append(point)
    return sorted(points, key=lambda point: point.timestamp) or None


def _downsample(points: list[IntradayPoint], minutes: int) -> list[IntradayPoint]:
    if not points:
        return []

    buckets: dict[int, IntradayPoint] = {}
    for point in points:
        epoch = int(point.timestamp.timestamp())
        bucket_epoch = epoch - (epoch % (minutes * 60))
        bucket_timestamp = datetime.fromtimestamp(bucket_epoch, tz=UTC).astimezone(BEIJING_TZ)
        buckets[bucket_epoch] = IntradayPoint(timestamp=bucket_timestamp, value=point.value)
    return sorted(buckets.values(), key=lambda point: point.timestamp)


async def _pg_upsert_candles(symbol: str, interval: str, points: list[IntradayPoint]) -> None:
    async with AsyncSessionLocal() as db:
        for point in points:
            existing = await db.scalar(
                select(MarketCandle).where(
                    MarketCandle.symbol == symbol,
                    MarketCandle.interval == interval,
                    MarketCandle.timestamp == point.timestamp,
                )
            )
            if existing is None:
                db.add(
                    MarketCandle(
                        symbol=symbol,
                        interval=interval,
                        timestamp=point.timestamp,
                        close=round(point.value, 2),
                    )
                )
        await db.commit()


async def _pg_has_full_year(symbol: str) -> bool:
    async with AsyncSessionLocal() as db:
        count = await db.scalar(
            select(sa_func.count()).where(
                MarketCandle.symbol == symbol, MarketCandle.interval == "60m"
            )
        )
        return (count or 0) >= 1200


async def _check_pg_candle_integrity() -> None:
    """Delete PostgreSQL candle rows that are unreasonably far from expected index values."""
    async with AsyncSessionLocal() as db:
        for config in INDEX_CONFIGS:
            if config.fallback_value <= 0:
                continue
            for interval in ("15m", "60m"):
                result = await db.execute(
                    select(
                        sa_func.count(),
                        sa_func.min(MarketCandle.close),
                        sa_func.max(MarketCandle.close),
                    ).where(
                        MarketCandle.symbol == config.symbol,
                        MarketCandle.interval == interval,
                    )
                )
                count, min_value, max_value = result.one()
                if count == 0 or min_value is None or max_value is None:
                    continue
                if (
                    max_value > config.fallback_value * 1.8
                    or min_value < config.fallback_value * 0.2
                ):
                    await db.execute(
                        delete(MarketCandle).where(
                            MarketCandle.symbol == config.symbol,
                            MarketCandle.interval == interval,
                        )
                    )
                    LOGGER.warning(
                        "Deleted %d corrupted %s candles for %s "
                        "(range [%.2f, %.2f] vs expected ~%.2f)",
                        count,
                        interval,
                        config.symbol,
                        min_value,
                        max_value,
                        config.fallback_value,
                    )
        await db.commit()


async def _pg_has_interval(symbol: str, interval: str) -> bool:
    async with AsyncSessionLocal() as db:
        count = await db.scalar(
            select(sa_func.count()).where(
                MarketCandle.symbol == symbol, MarketCandle.interval == interval
            )
        )
        return (count or 0) > 0


async def _pg_has_date(symbol: str, interval: str, target_date: date) -> bool:
    start = datetime.combine(target_date, time.min, tzinfo=BEIJING_TZ)
    end = datetime.combine(target_date, time.max, tzinfo=BEIJING_TZ)
    async with AsyncSessionLocal() as db:
        count = await db.scalar(
            select(sa_func.count()).where(
                MarketCandle.symbol == symbol,
                MarketCandle.interval == interval,
                MarketCandle.timestamp >= start,
                MarketCandle.timestamp <= end,
            )
        )
        return (count or 0) > 0


async def _pg_delete_older_than_1y(symbol: str) -> None:
    cutoff = _now_utc().astimezone(BEIJING_TZ) - timedelta(days=365)
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(MarketCandle).where(
                MarketCandle.symbol == symbol, MarketCandle.timestamp < cutoff
            )
        )
        await db.commit()


async def _pg_get_candles(symbol: str, interval: str, limit: int) -> list[IntradayPoint]:
    async with AsyncSessionLocal() as db:
        rows = await db.scalars(
            select(MarketCandle)
            .where(MarketCandle.symbol == symbol, MarketCandle.interval == interval)
            .order_by(MarketCandle.timestamp.desc())
            .limit(limit)
        )
        candles = list(rows)
        candles.reverse()
        return [
            IntradayPoint(
                timestamp=candle.timestamp
                if candle.timestamp.tzinfo
                else candle.timestamp.replace(tzinfo=BEIJING_TZ),
                value=candle.close,
            )
            for candle in candles
        ]


async def _redis_get_1d(symbol: str) -> list[IntradayPoint] | None:
    return await _redis_get_points(CANDLE_1D_KEY.format(symbol=symbol))


async def _redis_set_1d(symbol: str, points: list[IntradayPoint]) -> None:
    await _redis_set_points(CANDLE_1D_KEY.format(symbol=symbol), points, CANDLE_1D_TTL)


async def _redis_get_5d(symbol: str) -> list[IntradayPoint] | None:
    return await _redis_get_points(CANDLE_5D_KEY.format(symbol=symbol))


async def _redis_set_5d(symbol: str, points: list[IntradayPoint]) -> None:
    await _redis_set_points(CANDLE_5D_KEY.format(symbol=symbol), points, CANDLE_5D_TTL)


async def _redis_has_fresh_1d(config: IndexConfig) -> bool:
    points = await _redis_get_1d(config.symbol)
    if not points:
        return False
    session_date = _latest_session_date(config)
    zone = ZoneInfo(config.timezone)
    session_points = [
        point for point in points if point.timestamp.astimezone(zone).date() == session_date
    ]
    if len(session_points) < 10:
        return False

    if not _is_trading(config):
        expected = len(_elapsed_trading_minutes(config, session_date))
        if expected > 0 and len(session_points) < expected * 0.90:
            LOGGER.debug(
                "%s 1D data covers only %d/%d expected trading minutes (%.0f%%). "
                "Treating as stale.",
                config.symbol,
                len(session_points),
                expected,
                len(session_points) / expected * 100,
            )
            return False

    return True


async def _redis_has_fresh_5d(config: IndexConfig) -> bool:
    points = await _redis_get_5d(config.symbol)
    if not points:
        return False
    zone = ZoneInfo(config.timezone)
    dates = {point.timestamp.astimezone(zone).date() for point in points}
    return len(dates) >= 2


async def _redis_get_points(key: str) -> list[IntradayPoint] | None:
    client = create_redis_client()
    try:
        raw = await client.get(key)
    except Exception as exc:
        LOGGER.warning("Candle cache read for %s failed: %s: %s", key, type(exc).__name__, exc)
        return None
    finally:
        await client.aclose()
    return _deserialize_points(raw) if raw is not None else None


async def _redis_set_points(key: str, points: list[IntradayPoint], ttl: int) -> None:
    client = create_redis_client()
    try:
        await client.set(key, _serialize_points(points), ex=ttl)
    except Exception as exc:
        LOGGER.warning("Candle cache write for %s failed: %s: %s", key, type(exc).__name__, exc)
    finally:
        await client.aclose()


def _serialize_points(points: list[IntradayPoint]) -> str:
    return json.dumps(
        [{"t": int(point.timestamp.timestamp()), "v": round(point.value, 6)} for point in points],
        separators=(",", ":"),
    )


def _deserialize_points(value: object) -> list[IntradayPoint] | None:
    try:
        raw = value.decode() if isinstance(value, bytes) else str(value)
        payload = json.loads(raw)
    except (TypeError, UnicodeDecodeError, ValueError):
        return None
    if not isinstance(payload, list):
        return None

    points: list[IntradayPoint] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        epoch = _as_float(item.get("t"))
        point_value = _as_float(item.get("v"))
        if epoch is None or point_value is None or point_value <= 0:
            continue
        points.append(
            IntradayPoint(
                timestamp=datetime.fromtimestamp(epoch, tz=UTC).astimezone(BEIJING_TZ),
                value=point_value,
            )
        )
    return sorted(points, key=lambda point: point.timestamp) or None


def _filter_today(config: IndexConfig, points: list[IntradayPoint]) -> list[IntradayPoint]:
    session_date = _latest_session_date(config)
    zone = ZoneInfo(config.timezone)
    return [point for point in points if point.timestamp.astimezone(zone).date() == session_date]


def _trim_to_n_trading_days(
    config: IndexConfig, points: list[IntradayPoint], n: int
) -> list[IntradayPoint]:
    zone = ZoneInfo(config.timezone)
    grouped_dates = sorted({point.timestamp.astimezone(zone).date() for point in points})
    keep_dates = set(grouped_dates[-n:])
    return sorted(
        [point for point in points if point.timestamp.astimezone(zone).date() in keep_dates],
        key=lambda point: point.timestamp,
    )
