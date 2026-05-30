from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from datetime import datetime


@dataclass(frozen=True)
class IntradayPoint:
    """Represent one timestamped market index candle point."""

    timestamp: datetime
    value: float


@dataclass(frozen=True)
class IndexQuote:
    """Represent one market index quote and previous-close context."""

    current: float
    change_pct: float
    previous_close: float
    timestamp: datetime | None = None
