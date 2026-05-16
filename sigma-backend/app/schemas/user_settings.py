from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ReportType


class UserReportConfigRead(BaseModel):
    """User report configuration payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    report_frequency: ReportType
    markets: list[str]
    categories: list[str]
    is_active: bool


class UserReportConfigUpdate(BaseModel):
    """User report configuration update payload."""

    model_config = ConfigDict(extra="forbid")

    report_frequency: ReportType = ReportType.DAILY
    markets: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    is_active: bool = True
