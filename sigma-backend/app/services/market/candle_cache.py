"""Redis candle cache helpers."""

import json
import logging
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.services.market.config import BEIJING_TZ, IndexConfig
from app.services.market.types import IntradayPoint

LOGGER = logging.getLogger(__name__)

CANDLE_1D_KEY = "sigma:candles:1d:{symbol}"
CANDLE_5D_KEY = "sigma:candles:5d:{symbol}"
CANDLE_1D_TTL = 60 * 60 * 24 * 4
CANDLE_5D_TTL = 60 * 60 * 24 * 7


async def _redis_get_1d(symbol: str) -> list[IntradayPoint] | None:
    return await _redis_get_points(CANDLE_1D_KEY.format(symbol=symbol))


async def _redis_set_1d(symbol: str, points: list[IntradayPoint]) -> None:
    await _redis_set_points(CANDLE_1D_KEY.format(symbol=symbol), points, CANDLE_1D_TTL)


async def _redis_get_5d(symbol: str) -> list[IntradayPoint] | None:
    return await _redis_get_points(CANDLE_5D_KEY.format(symbol=symbol))


async def _redis_set_5d(symbol: str, points: list[IntradayPoint]) -> None:
    await _redis_set_points(CANDLE_5D_KEY.format(symbol=symbol), points, CANDLE_5D_TTL)


async def _redis_has_fresh_1d(config: IndexConfig) -> bool:
    from app.services.market import candles, indices

    points = await candles._redis_get_1d(config.symbol)
    if not points:
        return False
    session_date = indices._latest_session_date(config)
    zone = ZoneInfo(config.timezone)
    session_points = [
        point for point in points if point.timestamp.astimezone(zone).date() == session_date
    ]
    if len(session_points) < 10:
        return False

    if not indices._is_trading(config):
        expected = len(indices._elapsed_trading_minutes(config, session_date))
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
    from app.services.market import candles

    points = await candles._redis_get_5d(config.symbol)
    if not points:
        return False
    zone = ZoneInfo(config.timezone)
    dates = {point.timestamp.astimezone(zone).date() for point in points}
    return len(dates) >= 2


async def _redis_get_points(key: str) -> list[IntradayPoint] | None:
    from app.services.market import candles

    client = candles.create_redis_client()
    try:
        raw = await client.get(key)
    except Exception as exc:
        LOGGER.warning("Candle cache read for %s failed: %s: %s", key, type(exc).__name__, exc)
        return None
    finally:
        await client.aclose()
    return candles._deserialize_points(raw) if raw is not None else None


async def _redis_set_points(key: str, points: list[IntradayPoint], ttl: int) -> None:
    from app.services.market import candles

    client = candles.create_redis_client()
    try:
        await client.set(key, candles._serialize_points(points), ex=ttl)
    except Exception as exc:
        LOGGER.warning("Candle cache write for %s failed: %s: %s", key, type(exc).__name__, exc)
    finally:
        await client.aclose()


def _serialize_points(points: list[IntradayPoint]) -> str:
    return json.dumps(
        [{"t": int(point.timestamp.timestamp()), "v": round(point.value, 6)} for point in points],
        separators=(",", ":"),
    )


def _deserialize_points(value: Any) -> list[IntradayPoint] | None:
    from app.services.market import candles

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
        epoch = candles._as_float(item.get("t"))
        point_value = candles._as_float(item.get("v"))
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
    from app.services.market import indices

    session_date = indices._latest_session_date(config)
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
