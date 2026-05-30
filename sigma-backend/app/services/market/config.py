from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from zoneinfo import ZoneInfo

CACHE_KEY = "sigma:market-indices"
ACTIVE_CACHE_TTL_SECONDS = 15
CLOSED_CACHE_TTL_SECONDS = 120
STALE_CACHE_TTL_SECONDS = 300
MARKET_INDEX_REFRESH_DELAY_SECONDS = 0.6
BEIJING_TZ = ZoneInfo("Asia/Shanghai")


@dataclass(frozen=True)
class IndexConfig:
    """Describe one supported market index and its regular sessions."""

    symbol: str
    name: str
    market: str
    timezone: str
    sessions: tuple[tuple[time, time], ...]
    finnhub_symbol: str
    stooq_symbol: str | None
    fallback_value: float
    fallback_change_pct: float
    currency: str

    @property
    def open_time(self) -> time:
        """Return the first regular-session open time."""
        return self.sessions[0][0]

    @property
    def close_time(self) -> time:
        """Return the final regular-session close time."""
        return self.sessions[-1][1]


INDEX_CONFIGS: tuple[IndexConfig, ...] = (
    IndexConfig(
        "SPX",
        "S&P 500",
        "us",
        "America/New_York",
        ((time(9, 30), time(16, 0)),),
        "^GSPC",
        "^spx",
        7500.00,
        0.40,
        "USD",
    ),
    IndexConfig(
        "IXIC",
        "Nasdaq Composite",
        "us",
        "America/New_York",
        ((time(9, 30), time(16, 0)),),
        "^IXIC",
        "^ndq",
        26500.00,
        0.50,
        "USD",
    ),
    IndexConfig(
        "DJI",
        "Dow Jones Industrial Average",
        "us",
        "America/New_York",
        ((time(9, 30), time(16, 0)),),
        "^DJI",
        "^dji",
        50500.00,
        0.25,
        "USD",
    ),
    IndexConfig(
        "SSE",
        "SSE Composite",
        "cn",
        "Asia/Shanghai",
        ((time(9, 30), time(11, 30)), (time(13, 0), time(15, 0))),
        "000001.SS",
        "^shc",
        4150.00,
        0.20,
        "CNY",
    ),
    IndexConfig(
        "HSI",
        "Hang Seng Index",
        "hk",
        "Asia/Hong_Kong",
        ((time(9, 30), time(12, 0)), (time(13, 0), time(16, 0))),
        "^HSI",
        "^hsi",
        25600.00,
        0.30,
        "HKD",
    ),
    IndexConfig(
        "N225",
        "Nikkei 225",
        "jp",
        "Asia/Tokyo",
        ((time(9, 0), time(11, 30)), (time(12, 30), time(15, 30))),
        "^N225",
        "^nkx",
        64900.00,
        0.20,
        "JPY",
    ),
    IndexConfig(
        "FTSE",
        "FTSE 100",
        "eu",
        "Europe/London",
        ((time(8, 0), time(16, 30)),),
        "^FTSE",
        "^ukx",
        10450.00,
        0.20,
        "GBP",
    ),
    IndexConfig(
        "DAX",
        "DAX",
        "eu",
        "Europe/Berlin",
        ((time(9, 0), time(17, 30)),),
        "^GDAXI",
        "^dax",
        25400.00,
        0.35,
        "EUR",
    ),
    IndexConfig(
        "KOSPI",
        "KOSPI",
        "kr",
        "Asia/Seoul",
        ((time(9, 0), time(15, 30)),),
        "^KS11",
        "^kospi",
        8050.00,
        0.45,
        "KRW",
    ),
    IndexConfig(
        "TAIEX",
        "TAIEX",
        "tw",
        "Asia/Taipei",
        ((time(9, 0), time(13, 30)),),
        "^TWII",
        "^twse",
        43500.00,
        0.30,
        "TWD",
    ),
)
