"""Yahoo fetch, validation, and downsampling helpers for candle refreshes."""

import logging
import statistics
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.services.market.config import BEIJING_TZ, IndexConfig
from app.services.market.types import IntradayPoint
from app.services.market.yahoo_client import _fetch_yahoo_chart_result

LOGGER = logging.getLogger(__name__)

INTRADAY_GAP_MIN_EXPECTED_POINTS = 30
INTRADAY_GAP_MIN_COVERAGE_RATIO = 0.8


async def _fetch_and_store_1d_1min(config: IndexConfig, backfill_intraday_gap: bool = True) -> int:
    from app.services.market import candles

    points = await candles._yahoo_fetch(config, interval="1m", range_="1d")
    if not points:
        return 0

    if not candles._candles_are_reasonable(config, points):
        return 0

    stored_points = points
    if backfill_intraday_gap and candles._has_intraday_gap(config, points):
        five_day = await candles._yahoo_fetch(config, interval="1m", range_="5d")
        if five_day:
            today_points = candles._filter_today(config, five_day)
            if len(today_points) > len(points):
                stored_points = today_points
                LOGGER.info(
                    "Backfilled %s 1D candles from Yahoo 5D data after sparse 1D fetch: "
                    "%d -> %d points",
                    config.symbol,
                    len(points),
                    len(today_points),
                )

    stored_points = candles._dedupe_points_by_timestamp(stored_points)
    if not candles._candles_are_reasonable(config, stored_points):
        return 0

    await candles._redis_set_1d(config.symbol, stored_points)
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
    from app.services.market import candles

    now = candles._now_utc()
    session_date = candles._latest_session_date(config, now)
    zone = ZoneInfo(config.timezone)
    todays_points = [
        point for point in points if point.timestamp.astimezone(zone).date() == session_date
    ]

    if candles._is_trading(config, now):
        expected_count = len(candles._elapsed_trading_minutes(config, session_date, now))
    else:
        expected_count = len(candles._elapsed_trading_minutes(config, session_date))

    if expected_count < INTRADAY_GAP_MIN_EXPECTED_POINTS:
        return False

    return len(todays_points) < expected_count * coverage_ratio


async def _end_of_day_downsample_if_needed(config: IndexConfig) -> None:
    from app.services.market import candles

    symbol = config.symbol
    today_1min = await candles._redis_get_1d(symbol)
    if not today_1min or len(today_1min) < 10:
        return
    candle_date = today_1min[-1].timestamp.astimezone(BEIJING_TZ).date()
    if await candles._pg_has_date(symbol, "60m", candle_date):
        return

    fifteen_min = candles._downsample(today_1min, minutes=15)
    await candles._pg_upsert_candles(symbol, "15m", fifteen_min)

    sixty_min = candles._downsample(today_1min, minutes=60)
    await candles._pg_upsert_candles(symbol, "60m", sixty_min)

    existing_5d = await candles._redis_get_5d(symbol) or []
    trimmed = candles._trim_to_n_trading_days(config, [*existing_5d, *today_1min], n=5)
    await candles._redis_set_5d(symbol, trimmed)
    await candles._pg_delete_older_than_1y(symbol)

    LOGGER.info(
        "End-of-day downsample complete for %s: %d 15m candles, %d 60m candles",
        symbol,
        len(fifteen_min),
        len(sixty_min),
    )


async def _yahoo_fetch(
    config: IndexConfig, interval: str, range_: str
) -> list[IntradayPoint] | None:
    from app.services.market import candles

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
        value = candles._as_float(close)
        epoch = candles._as_float(timestamp)
        if value is None or epoch is None or value <= 0:
            continue
        point = IntradayPoint(
            timestamp=datetime.fromtimestamp(epoch, tz=UTC).astimezone(BEIJING_TZ),
            value=value,
        )
        if interval != "1m" or candles._is_within_session(point.timestamp, config):
            points.append(point)
    return sorted(points, key=lambda point: point.timestamp) or None
