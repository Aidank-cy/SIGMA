from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.collectors.base import BaseCollector
from app.collectors.factory import create_collector
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, UserRole
from app.models.user import User
from app.scheduler.engine import add_or_update_source_job, remove_source_job
from app.schemas.admin import AdminLogListResponse, RecentActivityItem
from app.schemas.source import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
    SourceListResponse,
    SourcePreviewResponse,
    SourceStatusResponse,
)
from app.services.pagination import paginate, paginate_scalars


async def list_sources(
    db: AsyncSession, page: int, page_size: int, current_user: User
) -> SourceListResponse:
    """List data sources visible to the current user."""
    predicate = _visible_source_predicate(current_user)
    page_result = await paginate_scalars(
        db,
        select(DataSource).where(predicate).order_by(DataSource.created_at.desc()),
        page,
        page_size,
        select(func.count()).select_from(DataSource).where(predicate),
    )
    return SourceListResponse(
        page=page,
        page_size=page_size,
        total=page_result.total,
        has_next=page_result.has_next,
        items=[DataSourceRead.model_validate(source) for source in page_result.items],
    )


async def create_source(
    db: AsyncSession, payload: DataSourceCreate, current_user: User
) -> DataSourceRead:
    """Create a user-owned data source."""
    source = DataSource(**payload.model_dump(), is_system=False, created_by=current_user.id)
    await _validate_source(source)
    db.add(source)
    await db.commit()
    await db.refresh(source)
    if source.is_active:
        add_or_update_source_job(source)
    return DataSourceRead.model_validate(source)


async def list_source_logs(
    db: AsyncSession,
    page: int,
    page_size: int,
    source_id: UUID | None,
    status_filter: CollectorStatus | None,
    date_from: datetime | None,
    date_to: datetime | None,
    current_user: User,
) -> AdminLogListResponse:
    """List collector logs for sources visible to the current user."""
    predicate = [_visible_source_predicate(current_user)]
    if source_id:
        predicate.append(CollectorLog.source_id == source_id)
    if status_filter:
        predicate.append(CollectorLog.status == status_filter)
    if date_from:
        predicate.append(CollectorLog.executed_at >= date_from)
    if date_to:
        predicate.append(CollectorLog.executed_at <= date_to)

    count_statement = (
        select(func.count())
        .select_from(CollectorLog)
        .join(DataSource, DataSource.id == CollectorLog.source_id)
        .where(*predicate)
    )
    total = await db.scalar(count_statement)
    success_total = await db.scalar(
        select(func.count())
        .select_from(CollectorLog)
        .join(DataSource, DataSource.id == CollectorLog.source_id)
        .where(*predicate, CollectorLog.status == CollectorStatus.SUCCESS)
    )
    page_result = await paginate(
        db,
        select(CollectorLog, DataSource.name)
        .join(DataSource, DataSource.id == CollectorLog.source_id)
        .where(*predicate)
        .order_by(CollectorLog.executed_at.desc()),
        page,
        page_size,
        count_statement,
    )
    total_value = total or 0
    return AdminLogListResponse(
        page=page,
        page_size=page_size,
        total=total_value,
        has_next=page_result.has_next,
        success_rate=(success_total or 0) / total_value if total_value else 0.0,
        items=[_activity_item(log, source_name) for log, source_name in page_result.items],
    )


async def update_source(
    db: AsyncSession, source_id: UUID, payload: DataSourceUpdate, current_user: User
) -> DataSourceRead:
    """Update a source owned by the user or any source as admin."""
    source = await _get_owned_source(db, source_id, current_user)
    if source.is_system and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="System source is protected"
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, key, value)
    await _validate_source(source)
    await db.commit()
    await db.refresh(source)
    if source.is_active:
        add_or_update_source_job(source)
    else:
        remove_source_job(source.id)
    return DataSourceRead.model_validate(source)


async def delete_source(db: AsyncSession, source_id: UUID, current_user: User) -> None:
    """Delete a non-system source."""
    source = await _get_owned_source(db, source_id, current_user)
    if source.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="System source is protected"
        )
    await db.execute(delete(CollectorLog).where(CollectorLog.source_id == source_id))
    await db.execute(delete(CollectedItem).where(CollectedItem.source_id == source_id))
    await db.delete(source)
    await db.commit()
    remove_source_job(source_id)


async def test_source(
    db: AsyncSession,
    source_id: UUID,
    current_user: User,
    collector_factory: Callable[[DataSource], BaseCollector] = create_collector,
) -> SourcePreviewResponse:
    """Run a source collector without writing to the database."""
    source = await _get_owned_source(db, source_id, current_user)
    collector = collector_factory(source)
    items = await collector.collect()
    return SourcePreviewResponse(items=[dict(item) for item in items[:3]])


async def collect_source(
    db: AsyncSession,
    source_id: UUID,
    current_user: User,
    collect_job: Callable[[UUID], Awaitable[None]],
    create_task: Callable[[Awaitable[None]], Any],
    background_tasks: set[Any],
) -> dict[str, str]:
    """Trigger a real collection for the given source in the background."""
    source = await _get_owned_source(db, source_id, current_user)
    if not source.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source is not active")
    task = create_task(collect_job(source_id))
    if hasattr(task, "add_done_callback"):
        background_tasks.add(task)
        task.add_done_callback(background_tasks.discard)
    return {"status": "queued", "source_id": str(source_id)}


async def get_source_status(
    db: AsyncSession, source_id: UUID, current_user: User
) -> SourceStatusResponse:
    """Return recent collector status for a source."""
    await _get_owned_source(db, source_id, current_user)
    last_log = await db.scalar(
        select(CollectorLog)
        .where(CollectorLog.source_id == source_id)
        .order_by(CollectorLog.executed_at.desc())
        .limit(1)
    )
    since = datetime.now(UTC) - timedelta(hours=24)
    recent_logs = list(
        await db.scalars(
            select(CollectorLog).where(
                CollectorLog.source_id == source_id,
                CollectorLog.executed_at >= since,
            )
        )
    )
    successes = sum(1 for log in recent_logs if log.status == CollectorStatus.SUCCESS)
    success_rate = successes / len(recent_logs) if recent_logs else 0.0
    return SourceStatusResponse(
        last_status=last_log.status.value if last_log else None,
        last_error=last_log.error_message if last_log else None,
        last_executed_at=last_log.executed_at if last_log else None,
        success_rate_24h=success_rate,
    )


async def _get_owned_source(db: AsyncSession, source_id: UUID, user: User) -> DataSource:
    predicate = _visible_source_predicate(user)
    source = await db.scalar(select(DataSource).where(DataSource.id == source_id, predicate))
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    return source


def _visible_source_predicate(user: User) -> ColumnElement[bool] | bool:
    if user.role == UserRole.ADMIN:
        return True
    return or_(DataSource.is_system.is_(True), DataSource.created_by == user.id)


async def _validate_source(source: DataSource) -> None:
    collector = create_collector(source)
    if not await collector.validate_config():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid config for {source.source_type} source: check required fields",
        )


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
