from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.item import ItemListResponse


class WatchlistBase(BaseModel):
    """Shared watchlist payload fields."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    keywords: list[str] = Field(default_factory=list)
    sources: list[UUID] = Field(default_factory=list)
    markets: list[str] = Field(default_factory=list)


class WatchlistCreate(WatchlistBase):
    """Watchlist creation payload."""


class WatchlistUpdate(WatchlistBase):
    """Watchlist replacement payload."""


class WatchlistRead(WatchlistBase):
    """Watchlist response payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    item_count: int = 0


class WatchlistListResponse(BaseModel):
    """List of watchlists for the current user."""

    model_config = ConfigDict(extra="forbid")

    items: list[WatchlistRead]


class WatchlistItemsResponse(ItemListResponse):
    """Paginated watchlist item response."""


class WatchlistStatsResponse(BaseModel):
    """Dashboard stats for one watchlist."""

    model_config = ConfigDict(extra="forbid")

    matches_today: int
    bullish_pct: int


class WatchlistTrendDay(BaseModel):
    """Daily watchlist match count."""

    model_config = ConfigDict(extra="forbid")

    date: date
    count: int


class WatchlistTrendResponse(BaseModel):
    """Seven-day watchlist trend response."""

    model_config = ConfigDict(extra="forbid")

    days: list[WatchlistTrendDay]
