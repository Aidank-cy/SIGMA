from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.factory import create_collector
from app.database import get_db
from app.middleware.auth import require_role
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import UserRole
from app.models.user import User
from app.scheduler.engine import add_or_update_source_job, remove_source_job
from app.schemas.admin import AdminSourceLogsResponse, AdminSourcePreviewPayload, RecentActivityItem
from app.schemas.source import (
    DataSourceRead,
    DataSourceUpdate,
    SourceStatsResponse,
    SourcePreviewResponse,
    SystemDataSourceCreate,
)

router = APIRouter()


@router.post("/sources", response_model=DataSourceRead, status_code=status.HTTP_201_CREATED)
async def create_system_source(
    payload: SystemDataSourceCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> DataSourceRead:
    """Create a system source."""
    source = DataSource(
        **payload.model_dump(exclude={"is_system"}),
        is_system=True,
        created_by=None,
    )
    await _validate_source(source)
    db.add(source)
    await db.commit()
    await db.refresh(source)
    if source.is_active:
        add_or_update_source_job(source)
    return DataSourceRead.model_validate(source)


@router.post("/sources/test", response_model=SourcePreviewResponse)
async def preview_system_source(
    payload: AdminSourcePreviewPayload,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SourcePreviewResponse:
    """Run an unsaved source collector without writing to the database."""
    source = DataSource(**payload.model_dump(), is_system=True, created_by=None)
    await _validate_source(source)
    collector = create_collector(source)
    items = await collector.collect()
    return SourcePreviewResponse(items=[dict(item) for item in items[:3]])


@router.put("/sources/{source_id}/toggle", response_model=DataSourceRead)
async def toggle_system_source(
    source_id: UUID,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> DataSourceRead:
    """Toggle or update an admin-managed source."""
    source = await db.scalar(select(DataSource).where(DataSource.id == source_id))
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
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


@router.put("/sources/{source_id}", response_model=DataSourceRead)
async def update_system_source(
    source_id: UUID,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.ADMIN)),
) -> DataSourceRead:
    """Update an admin-managed source."""
    return await toggle_system_source(source_id, payload, db, admin)


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    """Delete any source from admin management."""
    source = await db.scalar(select(DataSource).where(DataSource.id == source_id))
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    await db.execute(delete(CollectorLog).where(CollectorLog.source_id == source_id))
    await db.execute(delete(CollectedItem).where(CollectedItem.source_id == source_id))
    await db.delete(source)
    await db.commit()
    remove_source_job(source_id)


@router.get("/sources/{source_id}/logs", response_model=AdminSourceLogsResponse)
async def get_system_source_logs(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSourceLogsResponse:
    """Return recent logs for a single source."""
    rows = (
        await db.execute(
            select(CollectorLog, DataSource.name)
            .join(DataSource, DataSource.id == CollectorLog.source_id)
            .where(CollectorLog.source_id == source_id)
            .order_by(CollectorLog.executed_at.desc())
            .limit(20)
        )
    ).all()
    return AdminSourceLogsResponse(
        items=[
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
    )


@router.get("/sources/stats", response_model=SourceStatsResponse)
async def get_source_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SourceStatsResponse:
    """Return aggregate source counts."""
    total = await db.scalar(select(func.count()).select_from(DataSource))
    active = await db.scalar(select(func.count()).select_from(DataSource).where(DataSource.is_active.is_(True)))
    system = await db.scalar(select(func.count()).select_from(DataSource).where(DataSource.is_system.is_(True)))
    return SourceStatsResponse(total=total or 0, active=active or 0, system=system or 0)


async def _validate_source(source: DataSource) -> None:
    collector = create_collector(source)
    if not await collector.validate_config():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid config")
