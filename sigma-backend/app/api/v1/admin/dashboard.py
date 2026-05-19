from datetime import date, datetime, timedelta, timezone
from typing import TypeVar

from fastapi import APIRouter, Depends
from pydantic import BaseModel, TypeAdapter
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, UserRole
from app.models.llm_usage_log import LLMUsageLog
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    CollectionTrendPoint,
    RecentActivityItem,
    SourceHealthItem,
)
from app.utils.redis_lock import create_redis_client

router = APIRouter()
TModel = TypeVar("TModel", bound=BaseModel)


@router.get("", response_model=AdminStatsResponse)
@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminStatsResponse:
    """Return dashboard aggregate statistics."""
    cached = await _cache_model("stats", AdminStatsResponse)
    if cached is not None:
        return cached

    today = datetime.now(timezone.utc).date()
    users = await db.scalar(select(func.count()).select_from(User))
    sources = await db.scalar(select(func.count()).select_from(DataSource))
    active_sources = await db.scalar(
        select(func.count()).select_from(DataSource).where(DataSource.is_active.is_(True))
    )
    items = await db.scalar(select(func.count()).select_from(CollectedItem))
    token_rows = await db.execute(
        select(
            func.sum(LLMUsageLog.input_tokens).label("input_tokens"),
            func.sum(LLMUsageLog.output_tokens).label("output_tokens"),
        ).where(func.date(LLMUsageLog.created_at) == today.isoformat())
    )
    token_row = token_rows.one()
    response = AdminStatsResponse(
        users=users or 0,
        sources=sources or 0,
        active_sources=active_sources or 0,
        items=items or 0,
        tokens_today=int((token_row.input_tokens or 0) + (token_row.output_tokens or 0)),
    )
    await _cache_set("stats", response.model_dump_json())
    return response


@router.get("/collection-trend", response_model=list[CollectionTrendPoint])
async def get_collection_trend(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> list[CollectionTrendPoint]:
    """Return collected item counts for the last seven days."""
    cached = await _cache_list("trend", CollectionTrendPoint)
    if cached is not None:
        return cached

    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=6)
    rows = await db.execute(
        select(func.date(CollectedItem.collected_at).label("day"), func.count().label("items"))
        .where(CollectedItem.collected_at >= datetime.combine(start, datetime.min.time(), timezone.utc))
        .group_by(func.date(CollectedItem.collected_at))
        .order_by(func.date(CollectedItem.collected_at))
    )
    counts = {date.fromisoformat(str(row.day)): int(row.items) for row in rows}
    response = [
        CollectionTrendPoint(day=start + timedelta(days=offset), items=counts.get(start + timedelta(days=offset), 0))
        for offset in range(7)
    ]
    await _cache_set("trend", TypeAdapter(list[CollectionTrendPoint]).dump_json(response).decode())
    return response


@router.get("/recent-activity", response_model=list[RecentActivityItem])
async def get_recent_activity(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> list[RecentActivityItem]:
    """Return recent collector activity."""
    cached = await _cache_list("activity", RecentActivityItem)
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
    await _cache_set("activity", TypeAdapter(list[RecentActivityItem]).dump_json(response).decode())
    return response


@router.get("/source-health", response_model=list[SourceHealthItem])
async def get_source_health(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> list[SourceHealthItem]:
    """Return source health summaries."""
    cached = await _cache_list("health", SourceHealthItem)
    if cached is not None:
        return cached

    sources = list(await db.scalars(select(DataSource).order_by(DataSource.name)))
    response = [await _source_health(db, source) for source in sources]
    await _cache_set("health", TypeAdapter(list[SourceHealthItem]).dump_json(response).decode())
    return response


async def _source_health(db: AsyncSession, source: DataSource) -> SourceHealthItem:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    logs = list(
        await db.scalars(
            select(CollectorLog)
            .where(CollectorLog.source_id == source.id, CollectorLog.executed_at >= since)
            .order_by(CollectorLog.executed_at.desc())
        )
    )
    last_success = await db.scalar(
        select(CollectorLog.executed_at)
        .where(
            CollectorLog.source_id == source.id,
            CollectorLog.status == CollectorStatus.SUCCESS,
        )
        .order_by(CollectorLog.executed_at.desc())
        .limit(1)
    )
    successes = sum(1 for log in logs if log.status == CollectorStatus.SUCCESS)
    rate = successes / len(logs) if logs else 0.0
    latest = logs[0] if logs else None
    status = _health_status(source.is_active, latest, rate)
    return SourceHealthItem(
        source_id=source.id,
        name=source.name,
        source_type=source.source_type.value,
        last_success=last_success,
        rate_24h=rate,
        status=status,
    )


def _health_status(is_active: bool, latest: CollectorLog | None, rate: float) -> str:
    if not is_active or latest is not None and latest.status != CollectorStatus.SUCCESS:
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


async def _cache_model(key: str, model: type[TModel]) -> TModel | None:
    value = await _cache_get(key)
    if value is None:
        return None
    return model.model_validate_json(value)


async def _cache_list(key: str, model: type[TModel]) -> list[TModel] | None:
    value = await _cache_get(key)
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
