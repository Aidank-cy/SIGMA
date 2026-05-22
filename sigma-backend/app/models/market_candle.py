from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MarketCandle(Base):
    """Stores downsampled market candle data for chart ranges."""

    __tablename__ = "market_candles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    interval: Mapped[str] = mapped_column(String(5), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("symbol", "interval", "timestamp", name="uq_market_candle"),
        Index("ix_market_candle_lookup", "symbol", "interval", "timestamp"),
    )
