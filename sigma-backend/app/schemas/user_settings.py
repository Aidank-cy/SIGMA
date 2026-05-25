from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import ReportType, UserLocale
from app.services.report_settings import DEFAULT_REPORT_MAX_TOKENS, REPORT_MAX_TOKEN_TYPES


class ReportTimeRange(BaseModel):
    """Structured report period configuration."""

    model_config = ConfigDict(extra="forbid")

    generation_time: str | None = None
    generation_day_of_week: int | None = None  # 0-6, Monday-Sunday
    generation_day_of_month: int | None = None  # 1-31
    start_day_offset: int | None = None
    end_day_offset: int | None = None
    start_time: str | None = None
    end_time: str | None = None
    start_day_of_month: int | None = None
    end_day_of_month: int | None = None


class UserReportConfigRead(BaseModel):
    """User report configuration payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    report_frequency: ReportType
    report_frequencies: list[ReportType]
    markets: list[str]
    categories: list[str]
    is_active: bool
    max_tokens: dict[str, int]
    time_ranges: dict[str, ReportTimeRange] = Field(default_factory=dict)


class UserReportConfigUpdate(BaseModel):
    """User report configuration update payload."""

    model_config = ConfigDict(extra="forbid")

    report_frequency: ReportType = ReportType.DAILY
    report_frequencies: list[ReportType] = Field(default_factory=lambda: [ReportType.DAILY])
    markets: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    is_active: bool = True
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

    @model_validator(mode="after")
    def normalize_frequency(self) -> "UserReportConfigUpdate":
        if not self.report_frequencies:
            self.report_frequencies = [self.report_frequency]
        else:
            self.report_frequency = self.report_frequencies[0]
        return self

    @field_validator("time_ranges")
    @classmethod
    def validate_time_ranges(cls, value: dict[str, ReportTimeRange]) -> dict[str, ReportTimeRange]:
        """Validate report time-range config keys."""
        validate_report_time_ranges(value)
        return value


class UserSettingsRead(BaseModel):
    """Aggregated user settings payload."""

    model_config = ConfigDict(extra="forbid")

    display_name: str
    locale: UserLocale
    data_retention_days: int
    report_frequency: ReportType
    report_frequencies: list[ReportType]
    markets: list[str]
    categories: list[str]
    is_active: bool
    max_tokens: dict[str, int]
    time_ranges: dict[str, ReportTimeRange] = Field(default_factory=dict)


class UserSettingsUpdate(BaseModel):
    """Aggregated user settings update payload."""

    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=120)
    locale: UserLocale
    data_retention_days: int
    report_frequency: ReportType = ReportType.DAILY
    report_frequencies: list[ReportType] = Field(default_factory=lambda: [ReportType.DAILY])
    markets: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    is_active: bool = True
    max_tokens: dict[str, int] = Field(
        default_factory=lambda: {
            report_type.value: DEFAULT_REPORT_MAX_TOKENS[report_type]
            for report_type in REPORT_MAX_TOKEN_TYPES
        }
    )
    time_ranges: dict[str, ReportTimeRange] = Field(default_factory=dict)

    @field_validator("data_retention_days")
    @classmethod
    def validate_retention(cls, value: int) -> int:
        """Restrict retention to supported UI choices."""
        if value not in {7, 30, 60, 90, 180, 365}:
            raise ValueError("Unsupported retention period")
        return value

    @model_validator(mode="after")
    def normalize_frequency(self) -> "UserSettingsUpdate":
        if not self.report_frequencies:
            self.report_frequencies = [self.report_frequency]
        else:
            self.report_frequency = self.report_frequencies[0]
        return self

    @field_validator("time_ranges")
    @classmethod
    def validate_time_ranges(cls, value: dict[str, ReportTimeRange]) -> dict[str, ReportTimeRange]:
        """Validate report time-range config keys."""
        validate_report_time_ranges(value)
        return value


class UserProfileUpdate(BaseModel):
    """User profile update payload."""

    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=120)
    locale: UserLocale


class UserRetentionUpdate(BaseModel):
    """User retention preference update payload."""

    model_config = ConfigDict(extra="forbid")

    data_retention_days: int

    @field_validator("data_retention_days")
    @classmethod
    def validate_retention(cls, value: int) -> int:
        """Restrict retention to supported UI choices."""
        if value not in {7, 30, 60, 90, 180, 365}:
            raise ValueError("Unsupported retention period")
        return value


class UserPasswordUpdate(BaseModel):
    """User password update payload."""

    model_config = ConfigDict(extra="forbid")

    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        """Require at least one letter and one digit."""
        has_letter = any(character.isalpha() for character in value)
        has_digit = any(character.isdigit() for character in value)
        if not has_letter or not has_digit:
            raise ValueError("Password must include at least one letter and one digit")
        return value


def validate_report_time_ranges(value: dict[str, ReportTimeRange]) -> None:
    allowed = {report_type.value for report_type in REPORT_MAX_TOKEN_TYPES}
    for key, time_range in value.items():
        if key not in allowed:
            raise ValueError(f"Unsupported report time range key: {key}")
        if time_range.generation_time is not None and _parse_hhmm(time_range.generation_time) is None:
            raise ValueError("Report generation time must use HH:mm format")
        if key == ReportType.WEEKLY.value:
            _validate_weekly_time_range(time_range)
        if key == ReportType.MONTHLY.value:
            _validate_monthly_time_range(time_range)


def _validate_weekly_time_range(time_range: ReportTimeRange) -> None:
    generation_day = time_range.generation_day_of_week
    start_offset = time_range.start_day_offset
    end_offset = time_range.end_day_offset
    start_minutes = _parse_hhmm(time_range.start_time)
    end_minutes = _parse_hhmm(time_range.end_time)
    if generation_day is not None and (generation_day < 0 or generation_day > 6):
        raise ValueError("Weekly report generation day must be between 0 and 6")
    if (
        start_offset is None
        or end_offset is None
        or start_minutes is None
        or end_minutes is None
        or start_offset < 0
        or end_offset < 0
        or start_offset > 14
        or end_offset > 14
    ):
        raise ValueError("Weekly report time range must include 0-14 day offsets and HH:mm times")
    span_minutes = (start_offset - end_offset) * 24 * 60 + end_minutes - start_minutes
    if span_minutes <= 0:
        raise ValueError("Weekly report time range start must be before end")
    if span_minutes < 24 * 60 or span_minutes > 14 * 24 * 60:
        raise ValueError("Weekly report time range must span between 1 and 14 days")


def _validate_monthly_time_range(time_range: ReportTimeRange) -> None:
    generation_day = time_range.generation_day_of_month
    start_day = time_range.start_day_of_month
    end_day = time_range.end_day_of_month
    if generation_day is not None and (generation_day < 1 or generation_day > 31):
        raise ValueError("Monthly report generation day must be between 1 and 31")
    if (
        start_day is None
        or end_day is None
        or start_day < 1
        or start_day > 31
        or end_day < 1
        or end_day > 31
    ):
        raise ValueError("Monthly report time range days must be between 1 and 31")
    if start_day > end_day:
        raise ValueError("Monthly report time range start day must be before or equal to end day")


def _parse_hhmm(value: str | None) -> int | None:
    if value is None:
        return None
    parts = value.split(":")
    if len(parts) != 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except ValueError:
        return None
    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        return None
    return hours * 60 + minutes
