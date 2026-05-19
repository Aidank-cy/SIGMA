from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import ReportType, UserLocale


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


class UserSettingsRead(BaseModel):
    """Aggregated user settings payload."""

    model_config = ConfigDict(extra="forbid")

    display_name: str
    locale: UserLocale
    data_retention_days: int
    report_frequency: ReportType
    markets: list[str]
    categories: list[str]
    is_active: bool


class UserSettingsUpdate(BaseModel):
    """Aggregated user settings update payload."""

    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=120)
    locale: UserLocale
    data_retention_days: int
    report_frequency: ReportType = ReportType.DAILY
    markets: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    is_active: bool = True

    @field_validator("data_retention_days")
    @classmethod
    def validate_retention(cls, value: int) -> int:
        """Restrict retention to supported UI choices."""
        if value not in {7, 30, 60, 90, 180, 365}:
            raise ValueError("Unsupported retention period")
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
