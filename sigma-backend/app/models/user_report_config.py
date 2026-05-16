from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import ReportType
from app.models.types import jsonb_type

if TYPE_CHECKING:
    from app.models.user import User


class UserReportConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-user report delivery configuration."""

    __tablename__ = "user_report_configs"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    report_frequency: Mapped[ReportType] = mapped_column(
        Enum(ReportType, name="report_type", values_callable=enum_values),
        default=ReportType.DAILY,
        nullable=False,
    )
    markets: Mapped[list[Any]] = mapped_column(jsonb_type(), default=list, nullable=False)
    categories: Mapped[list[Any]] = mapped_column(jsonb_type(), default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="report_config")
