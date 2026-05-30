from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import (
    CollectorStatus,
    ReportType,
    UserLocale,
    UserRole,
)
from app.schemas.user_settings import ReportTimeRange, validate_report_time_ranges
from app.services.report_settings import REPORT_MAX_TOKEN_TYPES


class AdminStatsResponse(BaseModel):
    """Admin dashboard aggregate counters."""

    model_config = ConfigDict(extra="forbid")

    users: int = Field(ge=0)
    sources: int = Field(ge=0)
    active_sources: int = Field(ge=0)
    items: int = Field(ge=0)
    tokens_today: int = Field(ge=0)


class CollectionTrendPoint(BaseModel):
    """Collection volume for a single day."""

    model_config = ConfigDict(extra="forbid")

    day: date
    items: int = Field(ge=0)


class RecentActivityItem(BaseModel):
    """Recent collector activity row."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    source_id: UUID
    source_name: str
    status: CollectorStatus
    items_count: int = Field(ge=0)
    error_message: str | None
    duration_ms: int = Field(ge=0)
    executed_at: datetime


class SourceHealthItem(BaseModel):
    """Admin source health response row."""

    model_config = ConfigDict(extra="forbid")

    source_id: UUID
    name: str = Field(min_length=1, max_length=160)
    source_type: str = Field(min_length=1, max_length=32)
    last_success: datetime | None
    rate_24h: float
    status: str = Field(min_length=1, max_length=16)


class AdminUserRead(BaseModel):
    """Admin-facing user payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    email: EmailStr
    display_name: str
    role: UserRole
    locale: UserLocale
    data_retention_days: int = Field(ge=1)
    is_active: bool
    created_at: datetime
    updated_at: datetime
    llm_key_count: int = Field(default=0, ge=0)
    source_count: int = Field(default=0, ge=0)


class AdminUserListResponse(BaseModel):
    """Paginated admin user list."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    has_next: bool
    items: list[AdminUserRead]


class AdminUserUpdate(BaseModel):
    """Admin user mutation payload."""

    model_config = ConfigDict(extra="forbid")

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

    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    has_next: bool
    success_rate: float
    items: list[RecentActivityItem]
