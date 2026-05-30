import re
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import IntelligenceCategory, Market, SourceType


class DataSourceBase(BaseModel):
    """Common data source fields."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    source_type: SourceType
    category: IntelligenceCategory
    market: Market
    config: dict[str, Any] = Field(default_factory=dict)
    schedule_cron: str = Field(min_length=9, max_length=120)
    max_execution_seconds: int = Field(default=300, ge=1, le=3600)
    is_active: bool = True

    @field_validator("config")
    @classmethod
    def sanitize_config(cls, value: dict[str, Any]) -> dict[str, Any]:
        """Strip script tags from source configuration values."""
        return _sanitize_config(value)


class DataSourceCreate(DataSourceBase):
    """Data source create payload."""


class DataSourceUpdate(BaseModel):
    """Data source update payload."""

    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: IntelligenceCategory | None = None
    market: Market | None = None
    config: dict[str, Any] | None = None
    schedule_cron: str | None = Field(default=None, min_length=9, max_length=120)
    max_execution_seconds: int | None = Field(default=None, ge=1, le=3600)
    is_active: bool | None = None

    @field_validator("config")
    @classmethod
    def sanitize_config(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        """Strip script tags from source configuration values."""
        return _sanitize_config(value) if value is not None else None


class DataSourceRead(DataSourceBase):
    """Data source response payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    is_system: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class SourceListResponse(BaseModel):
    """Paginated source list response."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    has_next: bool
    items: list[DataSourceRead]


class SourcePreviewResponse(BaseModel):
    """Source test collection preview response."""

    model_config = ConfigDict(extra="forbid")

    items: list[dict[str, Any]]


class SourceStatusResponse(BaseModel):
    """Source operational status response."""

    model_config = ConfigDict(extra="forbid")

    last_status: str | None = None
    last_error: str | None = None
    last_executed_at: datetime | None = None
    success_rate_24h: float


SCRIPT_PATTERN = re.compile(
    r"<\s*script\b[^>]*>.*?<\s*/\s*script\s*>|<\s*/?\s*script\b[^>]*>",
    re.IGNORECASE | re.DOTALL,
)


def _sanitize_config(value: dict[str, Any]) -> dict[str, Any]:
    return {str(key): _sanitize_value(item) for key, item in value.items()}


def _sanitize_value(value: Any) -> Any:
    if isinstance(value, str):
        return SCRIPT_PATTERN.sub("", value)
    if isinstance(value, dict):
        return _sanitize_config(value)
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    return value
