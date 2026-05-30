from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.user import User
from app.models.watchlist import Watchlist
from app.schemas.item import ItemListResponse
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistListResponse,
    WatchlistRead,
    WatchlistStatsResponse,
    WatchlistTrendDay,
    WatchlistTrendResponse,
    WatchlistUpdate,
)
from app.services.item_service import _sentiment_for_item, _summary

router = APIRouter()


@router.get("", response_model=WatchlistListResponse)
async def list_watchlists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistListResponse:
    """Return the current user's watchlists."""
    rows = await db.scalars(
        select(Watchlist)
        .where(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.created_at.asc())
    )
    watchlists = list(rows)
    items: list[WatchlistRead] = []
    for watchlist in watchlists:
        total = await db.scalar(
            select(func.count()).select_from(CollectedItem).where(*_item_predicate(watchlist))
        )
        items.append(
            WatchlistRead.model_validate(watchlist).model_copy(update={"item_count": total or 0})
        )
    return WatchlistListResponse(items=items)


@router.post("", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    payload: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistRead:
    """Create a watchlist for the current user."""
    watchlist = Watchlist(user_id=current_user.id, **_payload(payload))
    db.add(watchlist)
    await db.commit()
    await db.refresh(watchlist)
    return WatchlistRead.model_validate(watchlist)


@router.put("/{watchlist_id}", response_model=WatchlistRead)
async def update_watchlist(
    watchlist_id: UUID,
    payload: WatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistRead:
    """Replace a watchlist owned by the current user."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    for key, value in _payload(payload).items():
        setattr(watchlist, key, value)
    await db.commit()
    await db.refresh(watchlist)
    return WatchlistRead.model_validate(watchlist)


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a watchlist owned by the current user."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    await db.delete(watchlist)
    await db.commit()


@router.get("/{watchlist_id}/items", response_model=ItemListResponse)
async def list_watchlist_items(
    watchlist_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ItemListResponse:
    """Return collected items matching a watchlist's filters."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    predicate = _item_predicate(watchlist)
    total = await db.scalar(select(func.count()).select_from(CollectedItem).where(*predicate))
    rows = (
        await db.execute(
            select(CollectedItem, DataSource.name)
            .join(DataSource, DataSource.id == CollectedItem.source_id)
            .where(*predicate)
            .order_by(CollectedItem.published_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    return ItemListResponse(
        page=page,
        page_size=page_size,
        total=total or 0,
        has_next=(page * page_size) < (total or 0),
        items=[_summary(row[0], row[1]) for row in rows],
    )


@router.get("/{watchlist_id}/stats", response_model=WatchlistStatsResponse)
async def get_watchlist_stats(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistStatsResponse:
    """Return dashboard stats for one watchlist."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    predicate = _item_predicate(watchlist)
    since = datetime.now(UTC) - timedelta(hours=24)
    matches_today = await db.scalar(
        select(func.count())
        .select_from(CollectedItem)
        .where(*predicate, CollectedItem.published_at >= since)
    )
    rows = await db.scalars(
        select(CollectedItem)
        .where(*predicate)
        .order_by(CollectedItem.published_at.desc())
        .limit(100)
    )
    sentiments = [_sentiment_for_item(item) for item in rows]
    bullish_pct = round((sentiments.count("bullish") / len(sentiments)) * 100) if sentiments else 50
    return WatchlistStatsResponse(matches_today=matches_today or 0, bullish_pct=bullish_pct)


@router.get("/{watchlist_id}/trend", response_model=WatchlistTrendResponse)
async def get_watchlist_trend(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistTrendResponse:
    """Return seven days of watchlist match counts."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    today = datetime.now(UTC).date()
    start = today - timedelta(days=6)
    start_at = datetime.combine(start, datetime.min.time(), UTC)
    rows = await db.execute(
        select(func.date(CollectedItem.published_at).label("day"), func.count().label("count"))
        .where(*_item_predicate(watchlist), CollectedItem.published_at >= start_at)
        .group_by(func.date(CollectedItem.published_at))
        .order_by(func.date(CollectedItem.published_at))
    )
    counts = {datetime.fromisoformat(str(row.day)).date(): int(row.count) for row in rows}
    return WatchlistTrendResponse(
        days=[
            WatchlistTrendDay(
                date=start + timedelta(days=offset),
                count=counts.get(start + timedelta(days=offset), 0),
            )
            for offset in range(7)
        ]
    )


async def _owned_watchlist(db: AsyncSession, current_user: User, watchlist_id: UUID) -> Watchlist:
    watchlist = await db.scalar(
        select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
    )
    if watchlist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return watchlist


def _payload(payload: WatchlistCreate | WatchlistUpdate) -> dict[str, object]:
    values = payload.model_dump()
    values["keywords"] = [keyword.strip() for keyword in values["keywords"] if keyword.strip()]
    values["sources"] = [str(source_id) for source_id in values["sources"]]
    values["markets"] = [market.strip().lower() for market in values["markets"] if market.strip()]
    return values


def _item_predicate(watchlist: Watchlist) -> list[object]:
    predicate: list[object] = []
    if watchlist.sources:
        predicate.append(
            CollectedItem.source_id.in_([UUID(str(source)) for source in watchlist.sources])
        )
    if watchlist.markets:
        predicate.append(CollectedItem.market.in_(watchlist.markets))
    if watchlist.keywords:
        patterns = [f"%{keyword}%" for keyword in watchlist.keywords]
        predicate.append(
            or_(
                *[
                    or_(
                        CollectedItem.title.ilike(pattern), CollectedItem.content_raw.ilike(pattern)
                    )
                    for pattern in patterns
                ]
            )
        )
    return predicate
