from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CollectedItemCreate(BaseModel):
    """Normalized collected item ready for persistence."""

    model_config = ConfigDict(extra="forbid")

    source_id: UUID
    title: str = Field(min_length=1, max_length=500)
    content_raw: str = Field(min_length=1)
    content_url: str | None = Field(default=None, max_length=1000)
    summary: str | None = None
    category: str
    market: str
    published_at: datetime
    expires_at: datetime
    metadata_extra: dict[str, object] | None = None


class MinimalItem(BaseModel):
    """Minimal machine-consumable collected item payload."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    summary: str | None
    category: str
    market: str
    published_at: datetime


class ItemSummary(MinimalItem):
    """Full list item payload with source context."""

    content_url: str | None
    collected_at: datetime
    expires_at: datetime
    source_id: UUID
    source_name: str


class ItemDetail(ItemSummary):
    """Collected item detail payload."""

    content_raw: str
    metadata_extra: dict[str, object] | None = None
    sentiment: str = "neutral"
    keywords: list[str] = Field(default_factory=list)
    related: list[MinimalItem] = Field(default_factory=list)


class ItemListResponse(BaseModel):
    """Paginated item list response."""

    model_config = ConfigDict(extra="forbid")

    page: int
    page_size: int
    total: int
    has_next: bool
    items: list[MinimalItem] | list[ItemSummary]
