from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_admin
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    CollectionTrendPoint,
    RecentActivityItem,
    SourceHealthItem,
)
from app.services import admin_dashboard_service

router = APIRouter()
_cache_get = admin_dashboard_service._cache_get
_cache_set = admin_dashboard_service._cache_set


@router.get("", response_model=AdminStatsResponse)
@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> AdminStatsResponse:
    """Return dashboard aggregate statistics."""
    return await admin_dashboard_service.get_admin_stats(db, _cache_get, _cache_set)


@router.get("/collection-trend", response_model=list[CollectionTrendPoint])
async def get_collection_trend(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[CollectionTrendPoint]:
    """Return collected item counts for the last seven days."""
    return await admin_dashboard_service.get_collection_trend(db, _cache_get, _cache_set)


@router.get("/recent-activity", response_model=list[RecentActivityItem])
async def get_recent_activity(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[RecentActivityItem]:
    """Return recent collector activity."""
    return await admin_dashboard_service.get_recent_activity(db, _cache_get, _cache_set)


@router.get("/source-health", response_model=list[SourceHealthItem])
async def get_source_health(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[SourceHealthItem]:
    """Return source health summaries."""
    return await admin_dashboard_service.get_source_health(db, _cache_get, _cache_set)
