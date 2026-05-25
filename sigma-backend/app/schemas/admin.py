from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import (
    CollectorStatus,
    ReportType,
    UserLocale,
    UserRole,
)
from app.services.report_settings import REPORT_MAX_TOKEN_TYPES
from app.schemas.user_settings import ReportTimeRange, validate_report_time_ranges


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


class AdminUserReportConfigUpdate(BaseModel):
    """Admin mutation payload for another user's report configuration."""

    model_config = ConfigDict(extra="forbid")

    report_frequency: ReportType | None = None
    report_frequencies: list[ReportType] | None = None
    markets: list[str] | None = None
    categories: list[str] | None = None
    is_active: bool | None = None
    max_tokens: dict[str, int] = Field(default_factory=dict)
    time_ranges: dict[str, ReportTimeRange] = Field(default_factory=dict)

    @field_validator("max_tokens")
    @classmethod
    def validate_max_tokens(cls, value: dict[str, int]) -> dict[str, int]:
        """Validate report-token config keys and positive integer values."""
        allowed = {report_type.value for report_type in REPORT_MAX_TOKEN_TYPES}
        for key, max_tokens in value.items():
            if key not in allowed:
                raise ValueError(f"Unsupported report token limit key: {key}")
            if max_tokens <= 0 or max_tokens > 50000:
                raise ValueError("Report token limits must be between 1 and 50000")
        return value

    @field_validator("time_ranges")
    @classmethod
    def validate_time_ranges(cls, value: dict[str, ReportTimeRange]) -> dict[str, ReportTimeRange]:
        """Validate report time-range config keys."""
        validate_report_time_ranges(value)
        return value


class AdminLogListResponse(BaseModel):
    """Paginated collector log list."""

    page: int
    page_size: int
    total: int
    has_next: bool
    success_rate: float
    items: list[RecentActivityItem]
