from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import CollectorStatus

if TYPE_CHECKING:
    from app.models.data_source import DataSource


class CollectorLog(UUIDPrimaryKeyMixin, Base):
    """Collector execution audit record."""

    __tablename__ = "collector_logs"
    __table_args__ = (Index("ix_collector_logs_source_id_executed_at", "source_id", "executed_at"),)

    source_id: Mapped[UUID] = mapped_column(ForeignKey("data_sources.id"), nullable=False)
    status: Mapped[CollectorStatus] = mapped_column(
        Enum(CollectorStatus, name="collector_status", values_callable=enum_values),
        nullable=False,
    )
    items_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    source: Mapped[DataSource] = relationship(back_populates="logs")
