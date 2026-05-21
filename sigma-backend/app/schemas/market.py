from datetime import datetime

from pydantic import BaseModel, Field


class TradingSession(BaseModel):
    """One continuous exchange trading session."""

    open: str
    close: str


class TradingHours(BaseModel):
    """Exchange trading window for an index."""

    open: str
    close: str
    timezone: str
    sessions: list[TradingSession] = Field(min_length=1)


class MarketSparkline(BaseModel):
    """Timestamped price series for one chart range."""

    values: list[float] = Field(default_factory=list)
    times: list[str] = Field(default_factory=list)


class MarketIndex(BaseModel):
    """Current major market index quote."""

    symbol: str
    name: str
    value: float
    previous_close: float
    change_pct: float
    market: str
    currency: str
    is_trading: bool
    is_fallback_data: bool = False
    trading_hours: TradingHours
    sparkline_24h: list[float] = Field(default_factory=list)
    sparkline_times: list[str] = Field(default_factory=list)
    sparkline_ranges: dict[str, MarketSparkline] = Field(default_factory=dict)


class MarketIndicesResponse(BaseModel):
    """Machine-consumable market indices response."""

    indices: list[MarketIndex]
    updated_at: datetime
