from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import IntelligenceCategory, Market, SourceType


class DataSourceBase(BaseModel):
    """Common data source fields."""

    name: str = Field(min_length=1, max_length=160)
    source_type: SourceType
    category: IntelligenceCategory
    market: Market
    config: dict[str, object] = Field(default_factory=dict)
    schedule_cron: str = Field(min_length=9, max_length=120)
    max_execution_seconds: int = Field(default=300, ge=1, le=3600)
    is_active: bool = True


class DataSourceCreate(DataSourceBase):
    """Data source create payload."""


class SystemDataSourceCreate(DataSourceBase):
    """Admin payload for system data source creation."""

    is_system: bool = True


class DataSourceUpdate(BaseModel):
    """Data source update payload."""

    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: IntelligenceCategory | None = None
    market: Market | None = None
    config: dict[str, object] | None = None
    schedule_cron: str | None = Field(default=None, min_length=9, max_length=120)
    max_execution_seconds: int | None = Field(default=None, ge=1, le=3600)
    is_active: bool | None = None


class DataSourceRead(DataSourceBase):
    """Data source response payload."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_system: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class SourceListResponse(BaseModel):
    """Paginated source list response."""

    page: int
    page_size: int
    total: int
    has_next: bool
    items: list[DataSourceRead]


class SourcePreviewResponse(BaseModel):
    """Source test collection preview response."""

    items: list[dict[str, object]]


class SourceStatusResponse(BaseModel):
    """Source operational status response."""

    last_status: str | None = None
    last_error: str | None = None
    last_executed_at: datetime | None = None
    success_rate_24h: float


class SourceStatsResponse(BaseModel):
    """Admin aggregate source stats response."""

    total: int
    active: int
    system: int
