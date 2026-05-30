from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ReportType


class ReportSummary(BaseModel):
    """Paginated report list payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    report_type: ReportType
    title: str
    market_scope: list[str]
    category_scope: list[str]
    period_start: datetime
    period_end: datetime
    generated_at: datetime
    item_count: int = Field(ge=0)
    content: str
    sentiment_score: float = 0.5


class ReportDetail(ReportSummary):
    """Full report payload."""


class ReportListResponse(BaseModel):
    """Paginated reports response."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    has_next: bool
    items: list[ReportSummary]


class LatestReportsResponse(BaseModel):
    """Latest report by type."""

    model_config = ConfigDict(extra="forbid")

    items: list[ReportSummary]


class ManualReportGenerateRequest(BaseModel):
    """Admin manual report generation payload."""

    model_config = ConfigDict(extra="forbid")

    report_type: ReportType
    market_scope: list[str] = Field(default_factory=list)
    category_scope: list[str] = Field(default_factory=list)
    period_start: date
    period_end: date
    locale: str = "zh"
