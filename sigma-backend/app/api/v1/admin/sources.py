from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.factory import create_collector
from app.database import get_db
from app.middleware.auth import require_role
from app.models.data_source import DataSource
from app.models.enums import UserRole
from app.models.user import User
from app.scheduler.engine import add_or_update_source_job, remove_source_job
from app.schemas.source import (
    DataSourceRead,
    DataSourceUpdate,
    SourceStatsResponse,
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
