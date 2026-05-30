from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

from pydantic import BaseModel, TypeAdapter
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus
from app.models.llm_usage_log import LLMUsageLog
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    CollectionTrendPoint,
    RecentActivityItem,
    SourceHealthItem,
)
from app.utils.redis_lock import create_redis_client

CacheGet = Callable[[str], Awaitable[str | None]]
CacheSet = Callable[[str, str], Awaitable[None]]


async def get_admin_stats(
    db: AsyncSession, cache_get: CacheGet = None, cache_set: CacheSet = None
) -> AdminStatsResponse:
    """Return dashboard aggregate statistics."""
    cache_get = cache_get or _cache_get
    cache_set = cache_set or _cache_set
    cached = await _cache_model("stats", AdminStatsResponse, cache_get)
    if cached is not None:
        return cached

    today = datetime.now(UTC).date()
    start = datetime.combine(today, datetime.min.time(), UTC)
    end = start + timedelta(days=1)
    token_rows = await db.execute(
        select(
            func.sum(LLMUsageLog.input_tokens).label("input_tokens"),
            func.sum(LLMUsageLog.output_tokens).label("output_tokens"),
        ).where(LLMUsageLog.created_at >= start, LLMUsageLog.created_at < end)
    )
    token_row = token_rows.one()
    response = AdminStatsResponse(
        users=await _count(db, User),
        sources=await _count(db, DataSource),
        active_sources=await _count_active_sources(db),
        items=await _count(db, CollectedItem),
        tokens_today=int((token_row.input_tokens or 0) + (token_row.output_tokens or 0)),
    )
    await cache_set("stats", response.model_dump_json())
    return response


async def get_collection_trend(
    db: AsyncSession, cache_get: CacheGet = None, cache_set: CacheSet = None
) -> list[CollectionTrendPoint]:
    """Return collected item counts for the last seven days."""
    cache_get = cache_get or _cache_get
    cache_set = cache_set or _cache_set
    cached = await _cache_list("trend", CollectionTrendPoint, cache_get)
    if cached is not None:
        return cached

    today = datetime.now(UTC).date()
    start = today - timedelta(days=6)
    rows = await db.execute(
        select(func.date(CollectedItem.published_at).label("day"), func.count().label("items"))
        .where(CollectedItem.published_at >= datetime.combine(start, datetime.min.time(), UTC))
        .group_by(func.date(CollectedItem.published_at))
        .order_by(func.date(CollectedItem.published_at))
    )
    counts = {date.fromisoformat(str(row.day)): int(row.items) for row in rows}
    response = [
        CollectionTrendPoint(
            day=start + timedelta(days=offset), items=counts.get(start + timedelta(days=offset), 0)
        )
        for offset in range(7)
    ]
    await cache_set("trend", TypeAdapter(list[CollectionTrendPoint]).dump_json(response).decode())
    return response


async def get_recent_activity(
    db: AsyncSession, cache_get: CacheGet = None, cache_set: CacheSet = None
) -> list[RecentActivityItem]:
    """Return recent collector activity."""
    cache_get = cache_get or _cache_get
    cache_set = cache_set or _cache_set
    cached = await _cache_list("activity", RecentActivityItem, cache_get)
    if cached is not None:
        return cached

    rows = (
        await db.execute(
            select(CollectorLog, DataSource.name)
            .join(DataSource, DataSource.id == CollectorLog.source_id)
            .order_by(CollectorLog.executed_at.desc())
            .limit(20)
        )
    ).all()
    response = [_activity_item(log, source_name) for log, source_name in rows]
    await cache_set("activity", TypeAdapter(list[RecentActivityItem]).dump_json(response).decode())
    return response


async def get_source_health(
    db: AsyncSession, cache_get: CacheGet = None, cache_set: CacheSet = None
) -> list[SourceHealthItem]:
    """Return source health summaries."""
    cache_get = cache_get or _cache_get
    cache_set = cache_set or _cache_set
    cached = await _cache_list("health", SourceHealthItem, cache_get)
    if cached is not None:
        return cached

    sources = list(await db.scalars(select(DataSource).order_by(DataSource.name)))
    response = [await _source_health(db, source) for source in sources]
    await cache_set("health", TypeAdapter(list[SourceHealthItem]).dump_json(response).decode())
    return response


async def _count(db: AsyncSession, model: type[Any]) -> int:
    return await db.scalar(select(func.count()).select_from(model)) or 0


async def _count_active_sources(db: AsyncSession) -> int:
    return (
        await db.scalar(
            select(func.count()).select_from(DataSource).where(DataSource.is_active.is_(True))
        )
        or 0
    )


async def _source_health(db: AsyncSession, source: DataSource) -> SourceHealthItem:
    since = datetime.now(UTC) - timedelta(hours=24)
    logs = list(
        await db.scalars(
            select(CollectorLog)
            .where(CollectorLog.source_id == source.id, CollectorLog.executed_at >= since)
            .order_by(CollectorLog.executed_at.desc())
        )
    )
    last_success = await db.scalar(
        select(CollectorLog.executed_at)
        .where(CollectorLog.source_id == source.id, CollectorLog.status == CollectorStatus.SUCCESS)
        .order_by(CollectorLog.executed_at.desc())
        .limit(1)
    )
    successes = sum(1 for log in logs if log.status == CollectorStatus.SUCCESS)
    rate = successes / len(logs) if logs else 0.0
    latest = logs[0] if logs else None
    return SourceHealthItem(
        source_id=source.id,
        name=source.name,
        source_type=source.source_type.value,
        last_success=last_success,
        rate_24h=rate,
        status=_health_status(source.is_active, latest, rate),
    )


def _health_status(is_active: bool, latest: CollectorLog | None, rate: float) -> str:
    if not is_active or (latest is not None and latest.status != CollectorStatus.SUCCESS):
        return "red"
    if latest is None or rate < 0.8:
        return "yellow"
    return "green"


def _activity_item(log: CollectorLog, source_name: str) -> RecentActivityItem:
    return RecentActivityItem(
        id=log.id,
        source_id=log.source_id,
        source_name=source_name,
        status=log.status,
        items_count=log.items_count,
        error_message=log.error_message,
        duration_ms=log.duration_ms,
        executed_at=log.executed_at,
    )


async def _cache_model[TModel: BaseModel](
    key: str, model: type[TModel], cache_get: CacheGet
) -> TModel | None:
    value = await cache_get(key)
    if value is None:
        return None
    return model.model_validate_json(value)


async def _cache_list[TModel: BaseModel](
    key: str, model: type[TModel], cache_get: CacheGet
) -> list[TModel] | None:
    value = await cache_get(key)
    if value is None:
        return None
    return TypeAdapter(list[model]).validate_json(value)


async def _cache_get(key: str) -> str | None:
    client = create_redis_client()
    try:
        cached = await client.get(f"sigma:admin:dashboard:{key}")
    except Exception:
        return None
    finally:
        await client.aclose()
    return str(cached) if cached else None


async def _cache_set(key: str, value: str) -> None:
    client = create_redis_client()
    try:
        await client.set(f"sigma:admin:dashboard:{key}", value, ex=60)
    except Exception:
        return
    finally:
        await client.aclose()
