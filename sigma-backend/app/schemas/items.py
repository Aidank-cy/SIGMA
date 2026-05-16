from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MinimalItem(BaseModel):
    """Minimal machine-consumable collected item payload."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    summary: str | None
    category: str
    market: str
    published_at: datetime


class ItemListResponse(BaseModel):
    """Paginated item list response."""

    model_config = ConfigDict(extra="forbid")

    page: int
    page_size: int
    total: int
    has_next: bool
    items: list[MinimalItem]
