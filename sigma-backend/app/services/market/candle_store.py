"""PostgreSQL candle storage helpers."""

import logging
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import delete, select
from sqlalchemy import func as sa_func

from app.database import AsyncSessionLocal
from app.models.market_candle import MarketCandle
from app.services.market.config import BEIJING_TZ, INDEX_CONFIGS
from app.services.market.types import IntradayPoint

LOGGER = logging.getLogger(__name__)


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
    from app.services.market import candles

    cutoff = candles._now_utc().astimezone(BEIJING_TZ) - timedelta(days=365)
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
