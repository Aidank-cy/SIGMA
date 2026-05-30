"""Quote provider helpers for market index refreshes."""

import csv
import logging
import os

import httpx

from app.services.market.clock import (
    _as_float,
    _timestamp_from_epoch,
    _timestamp_from_exchange_fields,
)
from app.services.market.config import IndexConfig
from app.services.market.types import IndexQuote
from app.services.market.yahoo_client import _yahoo_meta_cache

LOGGER = logging.getLogger(__name__)
MARKET_QUOTE_HTTP_TIMEOUT_SECONDS = 8


async def _fetch_index_quote(config: IndexConfig) -> IndexQuote | None:
    from app.services.market import indices

    cached = _yahoo_meta_cache.get(config.symbol)
    if cached is not None:
        return cached
    quote = await indices._fetch_finnhub_quote(config)
    if quote is not None:
        return quote
    return await indices._fetch_stooq_quote(config)


async def _fetch_finnhub_quote(config: IndexConfig) -> IndexQuote | None:
    from app.services.market import indices

    token = os.getenv("FINNHUB_KEY", "")
    if not token:
        return None
    return await indices._fetch_finnhub_symbol_quote(config.finnhub_symbol, token)


async def _fetch_finnhub_symbol_quote(symbol: str, token: str) -> IndexQuote | None:
    try:
        async with httpx.AsyncClient(timeout=MARKET_QUOTE_HTTP_TIMEOUT_SECONDS) as client:
            response = await client.get(
                "https://finnhub.io/api/v1/quote",
                params={"symbol": symbol, "token": token},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        LOGGER.warning(
            "Finnhub quote request for %s failed with status %s.", symbol, exc.response.status_code
        )
        return None
    except httpx.HTTPError as exc:
        LOGGER.warning("Finnhub quote request for %s failed: %s.", symbol, type(exc).__name__)
        return None
    except Exception as exc:
        LOGGER.warning(
            "Finnhub quote request for %s failed: %s: %s.", symbol, type(exc).__name__, exc
        )
        return None

    current = _as_float(payload.get("c"))
    previous = _as_float(payload.get("pc"))
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    return IndexQuote(
        current=current,
        change_pct=((current - previous) / previous) * 100,
        previous_close=previous,
        timestamp=_timestamp_from_epoch(payload.get("t")),
    )


async def _fetch_stooq_quote(config: IndexConfig) -> IndexQuote | None:
    if config.stooq_symbol is None:
        return None
    try:
        async with httpx.AsyncClient(timeout=MARKET_QUOTE_HTTP_TIMEOUT_SECONDS) as client:
            response = await client.get(
                "https://stooq.com/q/l/",
                params={"e": "csv", "f": "sd2t2ohlcvp", "h": "", "s": config.stooq_symbol},
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        LOGGER.warning(
            "Stooq quote request for %s failed with status %s.",
            config.symbol,
            exc.response.status_code,
        )
        return None
    except httpx.HTTPError as exc:
        LOGGER.warning(
            "Stooq quote request for %s failed: %s: %s.", config.symbol, type(exc).__name__, exc
        )
        return None
    except Exception as exc:
        LOGGER.warning(
            "Stooq quote request for %s failed: %s: %s.", config.symbol, type(exc).__name__, exc
        )
        return None

    rows = list(csv.DictReader(response.text.splitlines()))
    if not rows:
        return None
    current = _as_float(rows[0].get("Close"))
    previous = _as_float(rows[0].get("Prev"))
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    return IndexQuote(
        current=current,
        change_pct=((current - previous) / previous) * 100,
        previous_close=previous,
        timestamp=_timestamp_from_exchange_fields(config, rows[0].get("Date"), rows[0].get("Time")),
    )


async def _quote_from_redis_candle(config: IndexConfig) -> IndexQuote | None:
    """Derive a quote from the latest Redis 1D candle point."""
    from app.services.market import candles

    points = await candles._redis_get_1d(config.symbol)
    if not points or len(points) < 2:
        return None
    current = points[-1].value
    first = points[0].value
    if current <= 0 or first <= 0:
        return None
    return IndexQuote(
        current=current,
        change_pct=((current - first) / first) * 100,
        previous_close=first,
        timestamp=points[-1].timestamp,
    )
