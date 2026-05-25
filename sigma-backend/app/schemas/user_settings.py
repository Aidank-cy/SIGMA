from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import ReportType, UserLocale
from app.services.report_settings import DEFAULT_REPORT_MAX_TOKENS, REPORT_MAX_TOKEN_TYPES


class UserReportConfigRead(BaseModel):
    """User report configuration payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    report_frequency: ReportType
    report_frequencies: list[ReportType]
    markets: list[str]
    categories: list[str]
    is_active: bool
    max_tokens: dict[str, int]


class UserReportConfigUpdate(BaseModel):
    """User report configuration update payload."""

    model_config = ConfigDict(extra="forbid")

    report_frequency: ReportType = ReportType.DAILY
    report_frequencies: list[ReportType] = Field(default_factory=lambda: [ReportType.DAILY])
    markets: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    is_active: bool = True
    max_tokens: dict[str, int] = Field(default_factory=dict)

    @field_validator("max_tokens")
    @classmethod
    def validate_max_tokens(cls, value: dict[str, int]) -> dict[str, int]:
        """Validate report-token config keys and positive integer values."""
        allowed = {report_type.value for report_type in REPORT_MAX_TOKEN_TYPES}
        for key, max_tokens in value.items():
            if key not in allowed:
                raise ValueError(f"Unsupported report token limit key: {key}")
            if max_tokens <= 0:
                raise ValueError("Report token limits must be positive")
        return value

    @model_validator(mode="after")
    def normalize_frequency(self) -> "UserReportConfigUpdate":
        if not self.report_frequencies:
            self.report_frequencies = [self.report_frequency]
        else:
            self.report_frequency = self.report_frequencies[0]
        return self


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
