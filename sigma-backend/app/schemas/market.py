from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TradingSession(BaseModel):
    """One continuous exchange trading session."""

    model_config = ConfigDict(extra="forbid")

    open: str = Field(min_length=5, max_length=5)
    close: str = Field(min_length=5, max_length=5)


class TradingHours(BaseModel):
    """Exchange trading window for an index."""

    model_config = ConfigDict(extra="forbid")

    open: str = Field(min_length=5, max_length=5)
    close: str = Field(min_length=5, max_length=5)
    timezone: str = Field(min_length=1, max_length=80)
    sessions: list[TradingSession] = Field(min_length=1)
    beijing_sessions: list[TradingSession] = Field(default_factory=list)


class MarketSparkline(BaseModel):
    """Timestamped price series for one chart range."""

    model_config = ConfigDict(extra="forbid")

    values: list[float] = Field(default_factory=list)
    times: list[str] = Field(default_factory=list)


class MarketIndex(BaseModel):
    """Current major market index quote."""

    model_config = ConfigDict(extra="forbid")

    symbol: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    value: float
    previous_close: float
    change_pct: float
    market: str = Field(min_length=1, max_length=32)
    currency: str = Field(min_length=1, max_length=8)
    is_trading: bool
    is_fallback_data: bool = False
    trading_hours: TradingHours
    sparkline_24h: list[float] = Field(default_factory=list)
    sparkline_times: list[str] = Field(default_factory=list)
    sparkline_ranges: dict[str, MarketSparkline] = Field(default_factory=dict)


class MarketIndicesResponse(BaseModel):
    """Machine-consumable market indices response."""

    model_config = ConfigDict(extra="forbid")

    indices: list[MarketIndex]
    updated_at: datetime
