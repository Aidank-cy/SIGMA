from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.factory import create_collector
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.scheduler.engine import add_or_update_source_job, remove_source_job
from app.schemas.source import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
    SourceListResponse,
)
from app.services.admin_service import _ensure_not_self, _get_user


async def list_admin_user_sources(
    db: AsyncSession, user_id: UUID, page: int, page_size: int, current_admin_id: UUID
) -> SourceListResponse:
    """List custom data sources owned by another user."""
    _ensure_not_self(user_id, current_admin_id)
    await _get_user(db, user_id)
    predicate = (DataSource.created_by == user_id, DataSource.is_system.is_(False))
    total = await db.scalar(select(func.count()).select_from(DataSource).where(*predicate))
    sources = list(
        await db.scalars(
            select(DataSource)
            .where(*predicate)
            .order_by(DataSource.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    total_value = total or 0
    return SourceListResponse(
        page=page,
        page_size=page_size,
        total=total_value,
        has_next=(page * page_size) < total_value,
        items=[DataSourceRead.model_validate(source) for source in sources],
    )


async def create_admin_user_source(
    db: AsyncSession, user_id: UUID, payload: DataSourceCreate, current_admin_id: UUID
) -> DataSourceRead:
    """Create a custom data source owned by another user."""
    _ensure_not_self(user_id, current_admin_id)
    await _get_user(db, user_id)
    source = DataSource(**payload.model_dump(), created_by=user_id, is_system=False)
    await _validate_source(source)
    db.add(source)
    await db.commit()
    await db.refresh(source)
    if source.is_active:
        add_or_update_source_job(source)
    return DataSourceRead.model_validate(source)


async def update_admin_user_source(
    db: AsyncSession,
    user_id: UUID,
    source_id: UUID,
    payload: DataSourceUpdate,
    current_admin_id: UUID,
) -> DataSourceRead:
    """Update a custom data source owned by another user."""
    _ensure_not_self(user_id, current_admin_id)
    await _get_user(db, user_id)
    source = await _get_user_source(db, user_id, source_id)
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


async def delete_admin_user_source(
    db: AsyncSession, user_id: UUID, source_id: UUID, current_admin_id: UUID
) -> None:
    """Delete a custom data source and its collected rows for another user."""
    _ensure_not_self(user_id, current_admin_id)
    await _get_user(db, user_id)
    source = await _get_user_source(db, user_id, source_id)
    deleted_source_id = source.id
    await db.execute(delete(CollectorLog).where(CollectorLog.source_id == source.id))
    await db.execute(delete(CollectedItem).where(CollectedItem.source_id == source.id))
    await db.delete(source)
    await db.commit()
    remove_source_job(deleted_source_id)


async def _get_user_source(db: AsyncSession, user_id: UUID, source_id: UUID) -> DataSource:
    source = await db.scalar(
        select(DataSource).where(
            DataSource.id == source_id,
            DataSource.created_by == user_id,
            DataSource.is_system.is_(False),
        )
    )
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    return source


async def _validate_source(source: DataSource) -> None:
    collector = create_collector(source)
    if not await collector.validate_config():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid config for {source.source_type} source: check required fields",
        )
