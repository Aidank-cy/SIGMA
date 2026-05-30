from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.item import ItemListResponse
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistListResponse,
    WatchlistRead,
    WatchlistStatsResponse,
    WatchlistTrendResponse,
    WatchlistUpdate,
)
from app.services import watchlist_service

router = APIRouter()


@router.get("", response_model=WatchlistListResponse)
async def list_watchlists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistListResponse:
    """Return the current user's watchlists."""
    return await watchlist_service.list_watchlists(db, current_user)


@router.post("", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    payload: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistRead:
    """Create a watchlist for the current user."""
    return await watchlist_service.create_watchlist(db, current_user, payload)


@router.put("/{watchlist_id}", response_model=WatchlistRead)
async def update_watchlist(
    watchlist_id: UUID,
    payload: WatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistRead:
    """Replace a watchlist owned by the current user."""
    return await watchlist_service.update_watchlist(db, current_user, watchlist_id, payload)


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a watchlist owned by the current user."""
    await watchlist_service.delete_watchlist(db, current_user, watchlist_id)


@router.get("/{watchlist_id}/items", response_model=ItemListResponse)
async def list_watchlist_items(
    watchlist_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ItemListResponse:
    """Return collected items matching a watchlist's filters."""
    return await watchlist_service.list_watchlist_items(
        db, current_user, watchlist_id, page, page_size
    )


@router.get("/{watchlist_id}/stats", response_model=WatchlistStatsResponse)
async def get_watchlist_stats(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistStatsResponse:
    """Return dashboard stats for one watchlist."""
    return await watchlist_service.get_watchlist_stats(db, current_user, watchlist_id)


@router.get("/{watchlist_id}/trend", response_model=WatchlistTrendResponse)
async def get_watchlist_trend(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistTrendResponse:
    """Return seven days of watchlist match counts."""
    return await watchlist_service.get_watchlist_trend(db, current_user, watchlist_id)
