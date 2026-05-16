from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import UserLocale, UserRole


class UserCreate(BaseModel):
    """Registration payload."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        """Require at least one letter and one digit."""
        has_letter = any(character.isalpha() for character in value)
        has_digit = any(character.isdigit() for character in value)
        if not has_letter or not has_digit:
            raise ValueError("Password must include at least one letter and one digit")
        return value


class UserLogin(BaseModel):
    """Login payload."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    """Password reset code request payload."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class PasswordResetVerify(BaseModel):
    """Password reset code verification payload."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation payload."""

    model_config = ConfigDict(extra="forbid")

    reset_token: str
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


class MessageResponse(BaseModel):
    """Simple message response."""

    model_config = ConfigDict(extra="forbid")

    message: str


class PasswordResetTokenResponse(BaseModel):
    """Temporary password reset token payload."""

    model_config = ConfigDict(extra="forbid")

    reset_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """Public user payload."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    email: EmailStr
    display_name: str
    role: UserRole
    locale: UserLocale
    data_retention_days: int
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """JWT token payload."""

    model_config = ConfigDict(extra="forbid")

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str | None = None
