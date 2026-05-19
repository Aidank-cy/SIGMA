import json
import math
import os
from dataclasses import dataclass
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

import httpx

from app.schemas.market import MarketIndex, MarketIndicesResponse, TradingHours
from app.utils.redis_lock import create_redis_client

CACHE_KEY = "sigma:market-indices"
CACHE_TTL_SECONDS = 60


@dataclass(frozen=True)
class IndexConfig:
    symbol: str
    name: str
    market: str
    timezone: str
    open_time: time
    close_time: time
    finnhub_symbol: str
    finnhub_proxy_symbol: str | None
    alpha_symbol: str
    fallback_value: float
    fallback_change_pct: float
    currency: str


INDEX_CONFIGS: tuple[IndexConfig, ...] = (
    IndexConfig("SPX", "S&P 500", "us", "America/New_York", time(9, 30), time(16, 0), "^GSPC", "SPY", "SPY", 5842.15, 0.41, "USD"),
    IndexConfig("IXIC", "Nasdaq Composite", "us", "America/New_York", time(9, 30), time(16, 0), "^IXIC", "QQQ", "QQQ", 18352.04, 0.56, "USD"),
    IndexConfig("DJI", "Dow Jones Industrial Average", "us", "America/New_York", time(9, 30), time(16, 0), "^DJI", "DIA", "DIA", 40218.33, 0.24, "USD"),
    IndexConfig("SSE", "SSE Composite", "cn", "Asia/Shanghai", time(9, 30), time(15, 0), "000001.SS", None, "000001.SHH", 3138.92, -0.18, "CNY"),
    IndexConfig("HSI", "Hang Seng Index", "hk", "Asia/Hong_Kong", time(9, 30), time(16, 0), "^HSI", None, "HSI", 19553.61, 0.32, "HKD"),
    IndexConfig("N225", "Nikkei 225", "jp", "Asia/Tokyo", time(9, 0), time(15, 30), "^N225", None, "N225", 38570.76, -0.12, "JPY"),
    IndexConfig("FTSE", "FTSE 100", "eu", "Europe/London", time(8, 0), time(16, 30), "^FTSE", None, "FTSE", 8433.21, 0.21, "GBP"),
    IndexConfig("DAX", "DAX", "eu", "Europe/Berlin", time(9, 0), time(17, 30), "^GDAXI", None, "DAX", 18772.85, 0.37, "EUR"),
)


async def get_market_indices() -> MarketIndicesResponse:
    """Return cached market indices or refresh them when missing."""
    cached = await _cache_get()
    if cached is not None:
        return MarketIndicesResponse.model_validate_json(cached)
    return await refresh_market_indices(force=True)


async def refresh_market_indices(force: bool = False) -> MarketIndicesResponse:
    """Refresh index quotes and cache them for ticker consumers."""
    cached = await _cache_get()
    if cached is not None and not force and not any_market_trading_now():
        return MarketIndicesResponse.model_validate_json(cached)

    indices = [await _build_index(config) for config in INDEX_CONFIGS]
    response = MarketIndicesResponse(indices=indices, updated_at=datetime.now(UTC))
    await _cache_set(response.model_dump_json())
    return response


def any_market_trading_now(now: datetime | None = None) -> bool:
    """Return whether any configured exchange is inside regular trading hours."""
    return any(_is_trading(config, now) for config in INDEX_CONFIGS)


async def _build_index(config: IndexConfig) -> MarketIndex:
    quote = await _fetch_index_quote(config)
    value = quote[0] if quote is not None else config.fallback_value
    change_pct = quote[1] if quote is not None else config.fallback_change_pct
    return MarketIndex(
        symbol=config.symbol,
        name=config.name,
        value=round(value, 2),
        change_pct=round(change_pct, 2),
        market=config.market,
        currency=config.currency,
        is_trading=_is_trading(config),
        trading_hours=TradingHours(
            open=config.open_time.strftime("%H:%M"),
            close=config.close_time.strftime("%H:%M"),
            timezone=config.timezone,
        ),
        sparkline_24h=_sparkline(value, change_pct),
    )


async def _fetch_index_quote(config: IndexConfig) -> tuple[float, float] | None:
    quote = await _fetch_finnhub_quote(config)
    if quote is not None:
        return quote
    return await _fetch_alpha_vantage_quote(config)


async def _fetch_finnhub_quote(config: IndexConfig) -> tuple[float, float] | None:
    token = os.getenv("FINNHUB_KEY", "")
    if not token:
        return None
    quote = await _fetch_finnhub_symbol_quote(config.finnhub_symbol, token)
    if quote is not None:
        return quote
    if config.finnhub_proxy_symbol:
        proxy_quote = await _fetch_finnhub_symbol_quote(config.finnhub_proxy_symbol, token)
        if proxy_quote is not None:
            _, change_pct = proxy_quote
            return config.fallback_value * (1 + change_pct / 100), change_pct
    return None


async def _fetch_finnhub_symbol_quote(symbol: str, token: str) -> tuple[float, float] | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://finnhub.io/api/v1/quote",
                params={"symbol": symbol, "token": token},
            )
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    current = _as_float(payload.get("c"))
    previous = _as_float(payload.get("pc"))
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    return current, ((current - previous) / previous) * 100


async def _fetch_alpha_vantage_quote(config: IndexConfig) -> tuple[float, float] | None:
    token = os.getenv("ALPHAVANTAGE_KEY", "")
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://www.alphavantage.co/query",
                params={"function": "GLOBAL_QUOTE", "symbol": config.alpha_symbol, "apikey": token},
            )
            response.raise_for_status()
            payload = response.json().get("Global Quote", {})
    except Exception:
        return None

    current = _as_float(payload.get("05. price"))
    change_text = str(payload.get("10. change percent", "")).removesuffix("%")
    change_pct = _as_float(change_text)
    if current is None or change_pct is None or current <= 0:
        return None
    return current, change_pct


def _is_trading(config: IndexConfig, now: datetime | None = None) -> bool:
    active_now = now.astimezone(ZoneInfo(config.timezone)) if now else datetime.now(ZoneInfo(config.timezone))
    if active_now.weekday() >= 5:
        return False
    current = active_now.time().replace(tzinfo=None)
    return config.open_time <= current < config.close_time


def _sparkline(value: float, change_pct: float) -> list[float]:
    """Generate per-minute price points for one trading day.

    480 points covers an 8-hour session at 1-minute resolution. The
    frontend resamples these values to each exchange's trading window.
    """
    num_points = 480
    start = value / (1 + change_pct / 100) if change_pct != -100 else value
    points: list[float] = []
    for index in range(num_points):
        progress = index / (num_points - 1)
        curve = math.sin(progress * math.pi * 2) * value * 0.0008
        points.append(round(start + (value - start) * progress + curve, 2))
    return points


def _as_float(value: object) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def _cache_get() -> str | None:
    client = create_redis_client()
    try:
        cached = await client.get(CACHE_KEY)
    except Exception:
        return None
    finally:
        await client.aclose()
    return str(cached) if cached else None


async def _cache_set(value: str) -> None:
    client = create_redis_client()
    try:
        await client.set(CACHE_KEY, value, ex=CACHE_TTL_SECONDS)
    except Exception:
        return
    finally:
        await client.aclose()


def decode_cached_payload(value: str) -> dict[str, object]:
    """Decode a cached payload for focused unit tests."""
    return json.loads(value)
