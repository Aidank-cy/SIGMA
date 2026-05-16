from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import IntelligenceCategory, Market, SourceType
from app.models.types import jsonb_type

if TYPE_CHECKING:
    from app.models.collected_item import CollectedItem
    from app.models.collector_log import CollectorLog
    from app.models.user import User


class DataSource(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Configured intelligence collection source."""

    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, name="source_type", values_callable=enum_values),
        nullable=False,
    )
    category: Mapped[IntelligenceCategory] = mapped_column(
        Enum(IntelligenceCategory, name="intelligence_category", values_callable=enum_values),
        nullable=False,
    )
    market: Mapped[Market] = mapped_column(
        Enum(Market, name="market", values_callable=enum_values),
        nullable=False,
    )
    config: Mapped[dict[str, Any]] = mapped_column(jsonb_type(), default=dict, nullable=False)
    schedule_cron: Mapped[str] = mapped_column(String(120), nullable=False)
    max_execution_seconds: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    creator: Mapped[User | None] = relationship(back_populates="data_sources")
    items: Mapped[list[CollectedItem]] = relationship(back_populates="source")
    logs: Mapped[list[CollectorLog]] = relationship(back_populates="source")
