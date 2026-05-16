from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import UserLocale, UserRole

if TYPE_CHECKING:
    from app.models.data_source import DataSource
    from app.models.user_report_config import UserReportConfig
    from app.models.watchlist import Watchlist


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Application user account."""

    __tablename__ = "users"
    __table_args__ = (Index("ix_users_email", "email", unique=True),)

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=enum_values),
        default=UserRole.USER,
        nullable=False,
    )
    locale: Mapped[UserLocale] = mapped_column(
        Enum(UserLocale, name="user_locale", values_callable=enum_values),
        default=UserLocale.ZH,
        nullable=False,
    )
    data_retention_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    data_sources: Mapped[list[DataSource]] = relationship(back_populates="creator")
    watchlists: Mapped[list[Watchlist]] = relationship(back_populates="user")
    report_config: Mapped[UserReportConfig | None] = relationship(back_populates="user")
