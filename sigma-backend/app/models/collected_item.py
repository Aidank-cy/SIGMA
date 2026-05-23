from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import IntelligenceCategory, Market
from app.models.types import jsonb_type

if TYPE_CHECKING:
    from app.models.data_source import DataSource


class CollectedItem(UUIDPrimaryKeyMixin, Base):
    """Raw and summarized intelligence item collected from a source."""

    __tablename__ = "collected_items"
    __table_args__ = (
        Index("ix_collected_items_category_market_collected_at", "category", "market", "collected_at"),
        Index("ix_collected_items_source_id_collected_at", "source_id", "collected_at"),
        Index("ix_collected_items_published_at", "published_at"),
        Index("ix_collected_items_expires_at", "expires_at"),
        UniqueConstraint("content_url", name="uq_collected_items_content_url"),
    )

    source_id: Mapped[UUID] = mapped_column(ForeignKey("data_sources.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content_raw: Mapped[str] = mapped_column(Text, nullable=False)
    content_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[IntelligenceCategory] = mapped_column(
        Enum(IntelligenceCategory, name="intelligence_category", values_callable=enum_values),
        nullable=False,
    )
    market: Mapped[Market] = mapped_column(
        Enum(Market, name="market", values_callable=enum_values),
        nullable=False,
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_extra: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        jsonb_type(),
        nullable=True,
    )
    embedding: Mapped[bytes | None] = mapped_column(
        LargeBinary,
        nullable=True,
        comment="Reserved for knowledge base / semantic search integration",
    )

    source: Mapped[DataSource] = relationship(back_populates="items")
