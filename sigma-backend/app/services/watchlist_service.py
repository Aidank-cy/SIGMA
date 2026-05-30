from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.services.pagination import paginate


async def list_watchlists(db: AsyncSession, current_user: User) -> WatchlistListResponse:
    """Return the current user's watchlists."""
    rows = await db.scalars(
        select(Watchlist)
        .where(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.created_at.asc())
    )
    items: list[WatchlistRead] = []
    for watchlist in list(rows):
        total = await db.scalar(
            select(func.count()).select_from(CollectedItem).where(*_item_predicate(watchlist))
        )
        items.append(
            WatchlistRead.model_validate(watchlist).model_copy(update={"item_count": total or 0})
        )
    return WatchlistListResponse(items=items)


async def create_watchlist(
    db: AsyncSession, current_user: User, payload: WatchlistCreate
) -> WatchlistRead:
    """Create a watchlist for the current user."""
    watchlist = Watchlist(user_id=current_user.id, **_payload(payload))
    db.add(watchlist)
    await db.commit()
    await db.refresh(watchlist)
    return WatchlistRead.model_validate(watchlist)


async def update_watchlist(
    db: AsyncSession, current_user: User, watchlist_id: UUID, payload: WatchlistUpdate
) -> WatchlistRead:
    """Replace a watchlist owned by the current user."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    for key, value in _payload(payload).items():
        setattr(watchlist, key, value)
    await db.commit()
    await db.refresh(watchlist)
    return WatchlistRead.model_validate(watchlist)


async def delete_watchlist(db: AsyncSession, current_user: User, watchlist_id: UUID) -> None:
    """Delete a watchlist owned by the current user."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    await db.delete(watchlist)
    await db.commit()


async def list_watchlist_items(
    db: AsyncSession, current_user: User, watchlist_id: UUID, page: int, page_size: int
) -> ItemListResponse:
    """Return collected items matching a watchlist's filters."""
    watchlist = await _owned_watchlist(db, current_user, watchlist_id)
    predicate = _item_predicate(watchlist)
    page_result = await paginate(
        db,
        select(CollectedItem, DataSource.name)
        .join(DataSource, DataSource.id == CollectedItem.source_id)
        .where(*predicate)
        .order_by(CollectedItem.published_at.desc()),
        page,
        page_size,
        select(func.count()).select_from(CollectedItem).where(*predicate),
    )
    return ItemListResponse(
        page=page,
        page_size=page_size,
        total=page_result.total,
        has_next=page_result.has_next,
        items=[_summary(row[0], row[1]) for row in page_result.items],
    )


async def get_watchlist_stats(
    db: AsyncSession, current_user: User, watchlist_id: UUID
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


async def get_watchlist_trend(
    db: AsyncSession, current_user: User, watchlist_id: UUID
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


def _payload(payload: WatchlistCreate | WatchlistUpdate) -> dict[str, Any]:
    values = payload.model_dump()
    values["keywords"] = [keyword.strip() for keyword in values["keywords"] if keyword.strip()]
    values["sources"] = [str(source_id) for source_id in values["sources"]]
    values["markets"] = [market.strip().lower() for market in values["markets"] if market.strip()]
    return values


def _item_predicate(watchlist: Watchlist) -> list[Any]:
    predicate: list[Any] = []
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
