from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import (
    CollectorStatus,
    UserLocale,
    UserRole,
)


class AdminStatsResponse(BaseModel):
    """Admin dashboard aggregate counters."""

    users: int
    sources: int
    active_sources: int
    items: int
    tokens_today: int


class CollectionTrendPoint(BaseModel):
    """Collection volume for a single day."""

    day: date
    items: int


class RecentActivityItem(BaseModel):
    """Recent collector activity row."""

    id: UUID
    source_id: UUID
    source_name: str
    status: CollectorStatus
    items_count: int
    error_message: str | None
    duration_ms: int
    executed_at: datetime


class SourceHealthItem(BaseModel):
    """Admin source health response row."""

    source_id: UUID
    name: str
    source_type: str
    last_success: datetime | None
    rate_24h: float
    status: str


class AdminUserRead(BaseModel):
    """Admin-facing user payload."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str
    role: UserRole
    locale: UserLocale
    data_retention_days: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    llm_key_count: int = 0
    source_count: int = 0


class AdminUserListResponse(BaseModel):
    """Paginated admin user list."""

    page: int
    page_size: int
    total: int
    has_next: bool
    items: list[AdminUserRead]


class AdminUserUpdate(BaseModel):
    """Admin user mutation payload."""

    role: UserRole | None = None
    is_active: bool | None = None


class AdminLogListResponse(BaseModel):
    """Paginated collector log list."""

    page: int
    page_size: int
    total: int
    has_next: bool
    success_rate: float
    items: list[RecentActivityItem]
