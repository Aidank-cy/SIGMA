import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.factory import create_collector
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, UserRole
from app.models.user import User
from app.scheduler.engine import add_or_update_source_job, remove_source_job
from app.scheduler.jobs import collect_from_source
from app.schemas.admin import AdminLogListResponse, RecentActivityItem
from app.schemas.source import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
    SourceListResponse,
    SourcePreviewResponse,
    SourceStatusResponse,
)

router = APIRouter()


@router.get("", response_model=SourceListResponse)
async def list_sources(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceListResponse:
    """List data sources visible to the current user."""
    predicate = _visible_source_predicate(current_user)
    total = await db.scalar(select(func.count()).select_from(DataSource).where(predicate))
    sources = await db.scalars(
        select(DataSource)
        .where(predicate)
        .order_by(DataSource.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list(sources)
    return SourceListResponse(
        page=page,
        page_size=page_size,
        total=total or 0,
        has_next=(page * page_size) < (total or 0),
        items=[DataSourceRead.model_validate(source) for source in items],
    )


@router.post("", response_model=DataSourceRead, status_code=status.HTTP_201_CREATED)
async def create_source(
    payload: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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


@router.get("/logs", response_model=AdminLogListResponse)
async def list_source_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    source_id: UUID | None = None,
    status: CollectorStatus | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminLogListResponse:
    """List collector logs for sources visible to the current user."""
    predicate = [_visible_source_predicate(current_user)]
    if source_id:
        predicate.append(CollectorLog.source_id == source_id)
    if status:
        predicate.append(CollectorLog.status == status)
    if date_from:
        predicate.append(CollectorLog.executed_at >= date_from)
    if date_to:
        predicate.append(CollectorLog.executed_at <= date_to)

    total = await db.scalar(
        select(func.count())
        .select_from(CollectorLog)
        .join(DataSource, DataSource.id == CollectorLog.source_id)
        .where(*predicate)
    )
    success_total = await db.scalar(
        select(func.count())
        .select_from(CollectorLog)
        .join(DataSource, DataSource.id == CollectorLog.source_id)
        .where(
            *predicate,
            CollectorLog.status == CollectorStatus.SUCCESS,
        )
    )
    rows = (
        await db.execute(
            select(CollectorLog, DataSource.name)
            .join(DataSource, DataSource.id == CollectorLog.source_id)
            .where(*predicate)
            .order_by(CollectorLog.executed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    items = [
        RecentActivityItem(
            id=log.id,
            source_id=log.source_id,
            source_name=source_name,
            status=log.status,
            items_count=log.items_count,
            error_message=log.error_message,
            duration_ms=log.duration_ms,
            executed_at=log.executed_at,
        )
        for log, source_name in rows
    ]
    total_value = total or 0
    return AdminLogListResponse(
        page=page,
        page_size=page_size,
        total=total_value,
        has_next=(page * page_size) < total_value,
        success_rate=(success_total or 0) / total_value if total_value else 0.0,
        items=items,
    )


@router.put("/{source_id}", response_model=DataSourceRead)
async def update_source(
    source_id: UUID,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DataSourceRead:
    """Update a source owned by the user or any source as admin."""
    source = await _get_owned_source(db, source_id, current_user)
    if source.is_system and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System source is protected")
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


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a non-system source."""
    source = await _get_owned_source(db, source_id, current_user)
    if source.is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System source is protected")
    await db.delete(source)
    await db.commit()
    remove_source_job(source_id)


@router.post("/{source_id}/test", response_model=SourcePreviewResponse)
async def test_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourcePreviewResponse:
    """Run a source collector without writing to the database."""
    source = await _get_owned_source(db, source_id, current_user)
    collector = create_collector(source)
    items = await collector.collect()
    return SourcePreviewResponse(items=[dict(item) for item in items[:3]])


@router.post("/{source_id}/collect")
async def collect_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Trigger a real collection for the given source in the background."""
    source = await _get_owned_source(db, source_id, current_user)
    if not source.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source is not active")
    asyncio.create_task(collect_from_source(source_id))
    return {"status": "queued", "source_id": str(source_id)}


@router.get("/{source_id}/status", response_model=SourceStatusResponse)
async def get_source_status(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceStatusResponse:
    """Return recent collector status for a source."""
    await _get_owned_source(db, source_id, current_user)
    last_log = await db.scalar(
        select(CollectorLog)
        .where(CollectorLog.source_id == source_id)
        .order_by(CollectorLog.executed_at.desc())
        .limit(1)
    )
    since = datetime.now(timezone.utc) - timedelta(hours=24)
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


def _visible_source_predicate(user: User):
    if user.role == UserRole.ADMIN:
        return True
    return or_(DataSource.is_system.is_(True), DataSource.created_by == user.id)


async def _validate_source(source: DataSource) -> None:
    collector = create_collector(source)
    if not await collector.validate_config():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid config")
