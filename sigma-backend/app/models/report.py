from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import ReportType
from app.models.types import jsonb_type


class Report(UUIDPrimaryKeyMixin, Base):
    """Generated intelligence report."""

    __tablename__ = "reports"

    report_type: Mapped[ReportType] = mapped_column(
        Enum(ReportType, name="report_type", values_callable=enum_values),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    market_scope: Mapped[list[Any]] = mapped_column(jsonb_type(), default=list, nullable=False)
    category_scope: Mapped[list[Any]] = mapped_column(jsonb_type(), default=list, nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    item_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
