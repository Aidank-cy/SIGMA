import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.factory import create_collector
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.enums import CollectorStatus
from app.models.user import User
from app.scheduler.jobs import collect_from_source
from app.schemas.admin import AdminLogListResponse
from app.schemas.source import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
    SourceListResponse,
    SourcePreviewResponse,
    SourceStatusResponse,
)
from app.services import source_service

router = APIRouter()
BACKGROUND_TASKS: set[Any] = set()


@router.get("", response_model=SourceListResponse)
async def list_sources(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceListResponse:
    """List data sources visible to the current user."""
    return await source_service.list_sources(db, page, page_size, current_user)


@router.post("", response_model=DataSourceRead, status_code=status.HTTP_201_CREATED)
async def create_source(
    payload: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DataSourceRead:
    """Create a user-owned data source."""
    return await source_service.create_source(db, payload, current_user)


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
    return await source_service.list_source_logs(
        db, page, page_size, source_id, status, date_from, date_to, current_user
    )


@router.put("/{source_id}", response_model=DataSourceRead)
async def update_source(
    source_id: UUID,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DataSourceRead:
    """Update a source owned by the user or any source as admin."""
    return await source_service.update_source(db, source_id, payload, current_user)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a non-system source."""
    await source_service.delete_source(db, source_id, current_user)


@router.post("/{source_id}/test", response_model=SourcePreviewResponse)
async def test_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourcePreviewResponse:
    """Run a source collector without writing to the database."""
    return await source_service.test_source(db, source_id, current_user, create_collector)


@router.post("/{source_id}/collect")
async def collect_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Trigger a real collection for the given source in the background."""
    return await source_service.collect_source(
        db, source_id, current_user, collect_from_source, asyncio.create_task, BACKGROUND_TASKS
    )


@router.get("/{source_id}/status", response_model=SourceStatusResponse)
async def get_source_status(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceStatusResponse:
    """Return recent collector status for a source."""
    return await source_service.get_source_status(db, source_id, current_user)
