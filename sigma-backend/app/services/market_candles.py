import asyncio
import json
import logging
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func as sa_func, select

from app.database import AsyncSessionLocal
from app.models.market_candle import MarketCandle
from app.services.market_indices import (
    BEIJING_TZ,
    INDEX_CONFIGS,
    IndexConfig,
    IntradayPoint,
    _as_float,
    _fetch_yahoo_chart_result,
    _is_within_session,
    _latest_session_date,
    _market_status_beijing,
    _now_utc,
)
from app.utils.redis_lock import create_redis_client

LOGGER = logging.getLogger(__name__)

CANDLE_1D_KEY = "sigma:candles:1d:{symbol}"
CANDLE_5D_KEY = "sigma:candles:5d:{symbol}"
CANDLE_1D_TTL = 60 * 60 * 24 * 2
CANDLE_5D_TTL = 60 * 60 * 24 * 7

TRADING_FETCH_INTERVAL = 30
COLD_START_FETCH_DELAY = 2.5
COLD_START_NOT_OPEN_DELAY = 30

_last_fetch_time: dict[str, datetime] = {}
_cold_start_done: dict[str, bool] = {}


async def candle_refresh_job() -> None:
    """Refresh per-market candle storage without blocking quote refreshes."""
    now_beijing = _now_utc().astimezone(BEIJING_TZ)

    for config in INDEX_CONFIGS:
        symbol = config.symbol
        status = _market_status_beijing(config, now_beijing)

        if not _cold_start_done.get(symbol, False):
            if not await _pg_has_full_year(symbol):
                await _cold_start_fetch(config, status)
                continue
            _cold_start_done[symbol] = True
            LOGGER.info("Cold start complete for %s", symbol)

        if status == "not_opened":
            continue
        if status == "trading":
            last = _last_fetch_time.get(symbol)
            now_utc = _now_utc()
            if last is not None and (now_utc - last).total_seconds() < TRADING_FETCH_INTERVAL:
                continue
            await _fetch_and_store_1d_1min(config)
            _last_fetch_time[symbol] = _now_utc()
            continue
        await _end_of_day_downsample_if_needed(config)


async def _cold_start_fetch(config: IndexConfig, status: str) -> None:
    symbol = config.symbol
    if status == "closed":
        await _cold_start_batch(config, delay=COLD_START_FETCH_DELAY)
        _cold_start_done[symbol] = True
        LOGGER.info("Cold start batch complete for %s (closed)", symbol)
        return

    last = _last_fetch_time.get(symbol)
    now_utc = _now_utc()
    if last is not None and (now_utc - last).total_seconds() < COLD_START_NOT_OPEN_DELAY:
        return
    await _cold_start_next_piece(config)
    _last_fetch_time[symbol] = _now_utc()


async def _cold_start_batch(config: IndexConfig, delay: float) -> None:
    symbol = config.symbol

    daily_points = await _yahoo_fetch(config, interval="1d", range_="1y")
    if daily_points:
        await _pg_upsert_candles(symbol, "1d", daily_points)
        LOGGER.info("Cold start: %s 1Y daily to PG (%d points)", symbol, len(daily_points))
    await asyncio.sleep(delay)

    thirty_min_points = await _yahoo_fetch(config, interval="30m", range_="1mo")
    if thirty_min_points:
        await _pg_upsert_candles(symbol, "30m", thirty_min_points)
        LOGGER.info("Cold start: %s 1M 30min to PG (%d points)", symbol, len(thirty_min_points))
    await asyncio.sleep(delay)

    one_min_points = await _yahoo_fetch(config, interval="1m", range_="5d")
    if one_min_points:
        await _redis_set_5d(symbol, one_min_points)
        today_points = _filter_today(config, one_min_points)
        if today_points:
            await _redis_set_1d(symbol, today_points)
        LOGGER.info("Cold start: %s 5D 1min to Redis (%d points)", symbol, len(one_min_points))


async def _cold_start_next_piece(config: IndexConfig) -> None:
    symbol = config.symbol
    if not await _pg_has_interval(symbol, "1d"):
        daily = await _yahoo_fetch(config, interval="1d", range_="1y")
        if daily:
            await _pg_upsert_candles(symbol, "1d", daily)
            LOGGER.info("Cold start piece: %s 1Y daily to PG", symbol)
        return

    if not await _pg_has_interval(symbol, "30m"):
        thirty = await _yahoo_fetch(config, interval="30m", range_="1mo")
        if thirty:
            await _pg_upsert_candles(symbol, "30m", thirty)
            LOGGER.info("Cold start piece: %s 1M 30min to PG", symbol)
        return

    if not await _redis_has_5d(symbol):
        one_min = await _yahoo_fetch(config, interval="1m", range_="5d")
        if one_min:
            await _redis_set_5d(symbol, one_min)
            today_points = _filter_today(config, one_min)
            if today_points:
                await _redis_set_1d(symbol, today_points)
            LOGGER.info("Cold start piece: %s 5D 1min to Redis", symbol)
        return

    _cold_start_done[symbol] = True


async def _fetch_and_store_1d_1min(config: IndexConfig) -> None:
    points = await _yahoo_fetch(config, interval="1m", range_="1d")
    if points:
        await _redis_set_1d(config.symbol, points)


async def _end_of_day_downsample_if_needed(config: IndexConfig) -> None:
    symbol = config.symbol
    today_1min = await _redis_get_1d(symbol)
    if not today_1min or len(today_1min) < 10:
        return
    candle_date = today_1min[-1].timestamp.astimezone(BEIJING_TZ).date()
    if await _pg_has_date(symbol, "1d", candle_date):
        return

    thirty_min = _downsample(today_1min, minutes=30)
    await _pg_upsert_candles(symbol, "30m", thirty_min)

    daily_close = IntradayPoint(timestamp=today_1min[-1].timestamp, value=today_1min[-1].value)
    await _pg_upsert_candles(symbol, "1d", [daily_close])

    existing_5d = await _redis_get_5d(symbol) or []
    trimmed = _trim_to_n_trading_days(config, [*existing_5d, *today_1min], n=5)
    await _redis_set_5d(symbol, trimmed)
    await _pg_delete_older_than_1y(symbol)

    LOGGER.info(
        "End-of-day downsample complete for %s: %d 30m candles, close=%.2f",
        symbol,
        len(thirty_min),
        daily_close.value,
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
            select(sa_func.count()).where(MarketCandle.symbol == symbol, MarketCandle.interval == "1d")
        )
        return (count or 0) >= 200


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


async def _redis_has_5d(symbol: str) -> bool:
    points = await _redis_get_5d(symbol)
    return bool(points)


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
