import json
import logging
import os
import statistics
import time as _time
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import delete, func as sa_func, select

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

TRADING_FETCH_INTERVAL = 30
COLD_START_NOT_OPEN_DELAY = 5
INTRADAY_GAP_MIN_EXPECTED_POINTS = 30
INTRADAY_GAP_MIN_COVERAGE_RATIO = 0.8
FINNHUB_CANDLE_MIN_INTERVAL_SECONDS = 60
_MAX_COLD_START_ATTEMPTS_PER_STEP = 10
_DATA_HEALTH_CHECK_INTERVAL = 300

_last_fetch_time: dict[str, datetime] = {}
_cold_start_done: dict[str, bool] = {}
_cold_start_attempts: dict[str, int] = {}
_finnhub_candle_last_fetch: dict[str, float] = {}
_last_health_check = 0.0
_pg_integrity_checked = False


async def candle_refresh_job() -> None:
    """Refresh per-market candle storage without blocking quote refreshes."""
    global _last_health_check, _pg_integrity_checked
    if not _pg_integrity_checked:
        try:
            await _check_pg_candle_integrity()
        except Exception as exc:
            LOGGER.warning("PostgreSQL candle integrity check failed: %s: %s", type(exc).__name__, exc)
        else:
            _pg_integrity_checked = True

    now_beijing = _now_utc().astimezone(BEIJING_TZ)

    cold_start_pending = [
        config for config in INDEX_CONFIGS if not _cold_start_done.get(config.symbol, False)
    ]
    if cold_start_pending:
        for config in cold_start_pending:
            status = _market_status_beijing(config, now_beijing)
            await _cold_start_fetch(config, status)
    else:
        for config in INDEX_CONFIGS:
            status = _market_status_beijing(config, now_beijing)

            if status == "not_opened":
                continue
            if status == "trading":
                last = _last_fetch_time.get(config.symbol)
                now_utc = _now_utc()
                if last is not None and (now_utc - last).total_seconds() < TRADING_FETCH_INTERVAL:
                    continue
                await _fetch_and_store_1d_1min(config)
                _last_fetch_time[config.symbol] = _now_utc()
                continue
            await _end_of_day_downsample_if_needed(config)

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
            stored_count = await _fetch_and_store_1d_1min(config, backfill_intraday_gap=backfill_intraday_gap)
            if stored_count:
                _cold_start_step_reset(symbol, "1D")
                LOGGER.info("Cold start piece: %s 1D 1min to Redis (%d points)", symbol, stored_count)
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
    return _cold_start_attempts.get(_cold_start_step_key(symbol, step), 0) >= _MAX_COLD_START_ATTEMPTS_PER_STEP


def _cold_start_step_reset(symbol: str, step: str) -> None:
    _cold_start_attempts.pop(_cold_start_step_key(symbol, step), None)


def _cold_start_step_reset_all(symbol: str) -> None:
    for step in ("1D", "5D", "15m", "60m"):
        _cold_start_step_reset(symbol, step)


async def _fetch_and_store_1d_1min(config: IndexConfig, backfill_intraday_gap: bool = True) -> int:
    points = await _yahoo_fetch(config, interval="1m", range_="1d")
    if not points:
        reference_value = await _fetch_candle_reference_value(config)
        points = await _fetch_finnhub_candles(config, reference_value=reference_value)
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
                    "Backfilled %s 1D candles from Yahoo 5D data after sparse 1D fetch: %d -> %d points",
                    config.symbol,
                    len(points),
                    len(today_points),
                )

    if stored_points is not points and not _candles_are_reasonable(config, stored_points):
        return 0

    await _redis_set_1d(config.symbol, stored_points)
    return len(stored_points)


async def _fetch_candle_reference_value(config: IndexConfig) -> float | None:
    try:
        from app.services.market_indices import _fetch_index_quote

        quote = await _fetch_index_quote(config)
    except Exception as exc:
        LOGGER.warning(
            "Unable to fetch candle reference quote for %s: %s: %s",
            config.symbol,
            type(exc).__name__,
            exc,
        )
        return None
    return quote.current if quote is not None and quote.current > 0 else None


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


def _has_intraday_gap(config: IndexConfig, points: list[IntradayPoint]) -> bool:
    now = _now_utc()
    session_date = _latest_session_date(config, now)
    zone = ZoneInfo(config.timezone)
    todays_points = [
        point for point in points
        if point.timestamp.astimezone(zone).date() == session_date
    ]

    if _is_trading(config, now):
        expected_count = len(_elapsed_trading_minutes(config, session_date, now))
    else:
        expected_count = len(_elapsed_trading_minutes(config, session_date))

    if expected_count < INTRADAY_GAP_MIN_EXPECTED_POINTS:
        return False

    return len(todays_points) < expected_count * INTRADAY_GAP_MIN_COVERAGE_RATIO


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


async def _yahoo_fetch(config: IndexConfig, interval: str, range_: str) -> list[IntradayPoint] | None:
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


async def _fetch_finnhub_candles(
    config: IndexConfig,
    reference_value: float | None = None,
) -> list[IntradayPoint] | None:
    token = os.getenv("FINNHUB_KEY", "")
    if not token:
        LOGGER.warning("Finnhub candle fallback for %s skipped because FINNHUB_KEY is not configured.", config.symbol)
        return None
    candle_symbol = config.finnhub_proxy_symbol or config.finnhub_symbol

    now = _time.monotonic()
    last_fetch = _finnhub_candle_last_fetch.get(config.symbol)
    if last_fetch is not None and now - last_fetch < FINNHUB_CANDLE_MIN_INTERVAL_SECONDS:
        LOGGER.warning("Finnhub candle fallback for %s skipped by per-symbol rate limit.", config.symbol)
        return None
    _finnhub_candle_last_fetch[config.symbol] = now

    now_utc = _now_utc()
    for resolution in ("5", "15", "60", "D"):
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                response = await client.get(
                    "https://finnhub.io/api/v1/stock/candle",
                    params={
                        "symbol": candle_symbol,
                        "resolution": resolution,
                        "from": str(int((now_utc - timedelta(days=1)).timestamp())),
                        "to": str(int(now_utc.timestamp())),
                        "token": token,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            LOGGER.warning(
                "Finnhub candle fallback for %s res=%s failed with status %s.",
                config.symbol,
                resolution,
                exc.response.status_code,
            )
            continue
        except httpx.HTTPError as exc:
            LOGGER.warning(
                "Finnhub candle fallback for %s res=%s failed: %s.",
                config.symbol,
                resolution,
                type(exc).__name__,
            )
            continue
        except Exception as exc:
            LOGGER.warning(
                "Finnhub candle fallback for %s res=%s failed: %s: %s.",
                config.symbol,
                resolution,
                type(exc).__name__,
                exc,
            )
            continue

        if payload.get("s") != "ok":
            LOGGER.warning(
                "Finnhub candle fallback for %s returned status %s for res=%s.",
                config.symbol,
                payload.get("s"),
                resolution,
            )
            continue
        closes = payload.get("c")
        timestamps = payload.get("t")
        if not isinstance(closes, list) or not isinstance(timestamps, list) or len(closes) != len(timestamps):
            LOGGER.warning("Finnhub candle fallback for %s returned malformed candle arrays.", config.symbol)
            continue

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
            if resolution == "D" or _is_within_session(point.timestamp, config):
                points.append(point)

        sorted_points = sorted(points, key=lambda point: point.timestamp)
        if not sorted_points:
            LOGGER.warning(
                "Finnhub candle fallback for %s returned no usable points for res=%s.",
                config.symbol,
                resolution,
            )
            continue
        if config.finnhub_proxy_symbol:
            if reference_value is None:
                reference_value = await _fetch_candle_reference_value(config)
            scaling_reference = reference_value if reference_value is not None else config.fallback_value
            median_value = statistics.median(point.value for point in sorted_points)
            scale = scaling_reference / median_value if median_value > 0 else 0
            if abs(scale - 1.0) > 0.05:
                sorted_points = [
                    IntradayPoint(timestamp=point.timestamp, value=round(point.value * scale, 2))
                    for point in sorted_points
                ]
                LOGGER.info(
                    "Scaled Finnhub proxy %s candles by %.2fx for %s (ref=%.2f)",
                    candle_symbol,
                    scale,
                    config.symbol,
                    scaling_reference,
                )
            scaled_median = statistics.median(point.value for point in sorted_points)
            if (
                config.fallback_value > 0
                and (scaled_median / config.fallback_value > 1.5 or scaled_median / config.fallback_value < 0.5)
            ):
                LOGGER.warning(
                    "Discarding Finnhub proxy candles for %s: scaled median=%.2f vs expected ~%.2f",
                    config.symbol,
                    scaled_median,
                    config.fallback_value,
                )
                continue
        LOGGER.info(
            "Finnhub candle fallback provided %d points for %s (res=%s)",
            len(sorted_points),
            config.symbol,
            resolution,
        )
        return sorted_points

    LOGGER.warning("Finnhub candle fallback exhausted all resolutions for %s", config.symbol)
    return None


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
            select(sa_func.count()).where(MarketCandle.symbol == symbol, MarketCandle.interval == "60m")
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
                if max_value > config.fallback_value * 1.8 or min_value < config.fallback_value * 0.2:
                    await db.execute(
                        delete(MarketCandle).where(
                            MarketCandle.symbol == config.symbol,
                            MarketCandle.interval == interval,
                        )
                    )
                    LOGGER.warning(
                        "Deleted %d corrupted %s candles for %s (range [%.2f, %.2f] vs expected ~%.2f)",
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
            select(sa_func.count()).where(MarketCandle.symbol == symbol, MarketCandle.interval == interval)
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
        await db.execute(delete(MarketCandle).where(MarketCandle.symbol == symbol, MarketCandle.timestamp < cutoff))
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
                timestamp=candle.timestamp if candle.timestamp.tzinfo else candle.timestamp.replace(tzinfo=BEIJING_TZ),
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
    session_points = [point for point in points if point.timestamp.astimezone(zone).date() == session_date]
    return len(session_points) >= 10


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


def _trim_to_n_trading_days(config: IndexConfig, points: list[IntradayPoint], n: int) -> list[IntradayPoint]:
    zone = ZoneInfo(config.timezone)
    grouped_dates = sorted({point.timestamp.astimezone(zone).date() for point in points})
    keep_dates = set(grouped_dates[-n:])
    return sorted(
        [point for point in points if point.timestamp.astimezone(zone).date() in keep_dates],
        key=lambda point: point.timestamp,
    )