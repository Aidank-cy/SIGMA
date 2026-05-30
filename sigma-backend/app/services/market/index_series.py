"""Market index candle-series readers."""

from app.schemas.market import MarketSparkline
from app.services.market.config import IndexConfig
from app.services.market.types import IntradayPoint


async def _read_intraday_from_redis(config: IndexConfig) -> list[IntradayPoint] | None:
    """Read latest 1-minute Redis candles, falling back to 5D Redis then PostgreSQL."""
    from app.services.market import candles

    points = await candles._redis_get_1d(config.symbol)
    if not points:
        points = await _latest_usable_redis_points(config, minimum_points=10)
    if not points:
        pg_points = await candles._pg_get_candles(config.symbol, "15m", limit=100)
        if pg_points and len(pg_points) >= 5:
            return _points_for_session_or_latest_date(config, pg_points, minimum_points=5)
        return None

    from app.services.market import indices

    now = indices._now_utc()
    if not indices._is_trading(config, now) and len(points) < 30:
        points = await _latest_usable_redis_points(config, minimum_points=30) or points

    if not indices._is_trading(config, now):
        if len(points) < 10:
            return None
        return points

    session_date = indices._latest_session_date(config)
    from zoneinfo import ZoneInfo

    current_session_points = [
        point
        for point in points
        if point.timestamp.astimezone(ZoneInfo(config.timezone)).date() == session_date
    ]
    return current_session_points if len(current_session_points) >= 10 else None


async def _latest_usable_redis_points(
    config: IndexConfig, minimum_points: int
) -> list[IntradayPoint] | None:
    from app.services.market import candles

    five_day = await candles._redis_get_5d(config.symbol)
    if not five_day:
        return None
    return _points_for_session_or_latest_date(config, five_day, minimum_points=minimum_points)


def _points_for_session_or_latest_date(
    config: IndexConfig, points: list[IntradayPoint], minimum_points: int
) -> list[IntradayPoint] | None:
    from zoneinfo import ZoneInfo

    from app.services.market import indices

    session_date = indices._latest_session_date(config)
    zone = ZoneInfo(config.timezone)
    session_points = [
        point for point in points if point.timestamp.astimezone(zone).date() == session_date
    ]
    if len(session_points) >= minimum_points:
        return session_points
    latest_date = points[-1].timestamp.astimezone(zone).date()
    latest_points = [
        point for point in points if point.timestamp.astimezone(zone).date() == latest_date
    ]
    return latest_points if len(latest_points) >= minimum_points else None


async def _read_candle_ranges(
    config: IndexConfig,
    value: float,
    change_pct: float,
) -> dict[str, MarketSparkline]:
    """Read chart range candles from Redis and PostgreSQL without fetching Yahoo."""
    from app.services.market import candles

    _ = (value, change_pct)
    ranges: dict[str, MarketSparkline] = {}

    data_5d = await candles._redis_get_5d(config.symbol)
    if not data_5d:
        pg_15m = await candles._pg_get_candles(config.symbol, "15m", limit=600)
        if pg_15m and len(pg_15m) >= 10:
            data_5d = pg_15m
    if data_5d:
        ranges["5D"] = MarketSparkline(
            values=[round(point.value, 2) for point in data_5d],
            times=[point.timestamp.isoformat() for point in data_5d],
        )
    else:
        ranges["5D"] = MarketSparkline(values=[], times=[])

    for range_key, interval, limit in (
        ("1M", "15m", 600),
        ("3M", "60m", 500),
        ("1Y", "60m", 1800),
    ):
        series = await candles._pg_get_candles(config.symbol, interval, limit=limit)
        ranges[range_key] = MarketSparkline(
            values=[round(point.value, 2) for point in series],
            times=[point.timestamp.isoformat() for point in series],
        )
    return ranges
