from datetime import datetime

from pydantic import BaseModel, Field


class TradingHours(BaseModel):
    """Exchange trading window for an index."""

    open: str
    close: str
    timezone: str


class MarketIndex(BaseModel):
    """Current major market index quote."""

    symbol: str
    name: str
    value: float
    change_pct: float
    market: str
    currency: str
    is_trading: bool
    trading_hours: TradingHours
    sparkline_24h: list[float] = Field(min_length=2)


class MarketIndicesResponse(BaseModel):
    """Machine-consumable market indices response."""

    indices: list[MarketIndex]
    updated_at: datetime
