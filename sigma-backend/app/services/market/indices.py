"""Market index quote refresh and cache orchestration."""

# ruff: noqa: F401
import asyncio
import logging
from datetime import date, datetime

from app.schemas.market import (
    MarketIndex,
    MarketIndicesResponse,
    MarketSparkline,
    TradingHours,
    TradingSession,
)
from app.services.market import clock as market_clock
from app.services.market.clock import (
    _previous_close_from_change,
    _sessions_to_beijing,
    _timestamp_from_epoch,
    _timestamp_from_exchange_fields,
)
from app.services.market.config import (
    BEIJING_TZ,
    INDEX_CONFIGS,
    MARKET_INDEX_REFRESH_DELAY_SECONDS,
    IndexConfig,
)
from app.services.market.index_cache import (
    _cache_get,
    _cache_set,
    _cached_payload_is_fresh,
    _market_cache_expiration_seconds,
    _market_cache_ttl_seconds,
    decode_cached_payload,
)
from app.services.market.index_quotes import (
    _fetch_finnhub_quote,
    _fetch_finnhub_symbol_quote,
    _fetch_index_quote,
    _fetch_stooq_quote,
    _quote_from_redis_candle,
)
from app.services.market.index_series import _read_candle_ranges, _read_intraday_from_redis
from app.services.market.types import IndexQuote, IntradayPoint

LOGGER = logging.getLogger(__name__)


def _now_utc() -> datetime:
    return market_clock._now_utc()


def _as_float(value: object) -> float | None:
    return market_clock._as_float(value)


def _is_trading(config: IndexConfig, now: datetime | None = None) -> bool:
    return market_clock._is_trading(config, now or _now_utc())


def _is_within_session(timestamp: datetime, config: IndexConfig) -> bool:
    return market_clock._is_within_session(timestamp, config)


def _latest_session_date(config: IndexConfig, now: datetime | None = None) -> date:
    return market_clock._latest_session_date(config, now or _now_utc())


def _elapsed_trading_minutes(
    config: IndexConfig, session_date: date, now: datetime | None = None
) -> list[datetime]:
    return market_clock._elapsed_trading_minutes(config, session_date, now or _now_utc())


def _trading_minutes(config: IndexConfig, session_date: date) -> list[datetime]:
    return market_clock._trading_minutes(config, session_date)


def _market_status_beijing(config: IndexConfig, now_beijing: datetime) -> str:
    return market_clock._market_status_beijing(config, now_beijing)


def any_market_trading_now(now: datetime | None = None) -> bool:
    """Return whether any configured exchange is inside regular trading hours."""
    return any(_is_trading(config, now) for config in INDEX_CONFIGS)


async def get_market_indices() -> MarketIndicesResponse:
    """Return cached market indices or refresh them when missing."""
    cached = await _cache_get()
    if cached is not None:
        try:
            response = MarketIndicesResponse.model_validate_json(cached)
        except Exception:
            response = None
        else:
            if _cached_payload_is_fresh(cached):
                return response
            LOGGER.warning(
                "Returning stale market-index cache while the scheduler refreshes provider data."
            )
            return response
    return await refresh_market_indices(force=True)


async def refresh_market_indices(force: bool = False) -> MarketIndicesResponse:
    """Refresh index quotes and cache them for ticker consumers."""
    cached = await _cache_get()
    if cached is not None and not force and _cached_payload_is_fresh(cached):
        return MarketIndicesResponse.model_validate_json(cached)

    indices: list[MarketIndex] = []
    for index, config in enumerate(INDEX_CONFIGS):
        indices.append(await _build_index(config))
        if index < len(INDEX_CONFIGS) - 1:
            await asyncio.sleep(MARKET_INDEX_REFRESH_DELAY_SECONDS)
    response = MarketIndicesResponse(indices=indices, updated_at=_now_utc())
    await _cache_set(response.model_dump_json())
    return response


async def _build_index(config: IndexConfig) -> MarketIndex:
    quote = await _fetch_index_quote(config)
    if quote is None:
        quote = await _quote_from_redis_candle(config)
    if (
        quote is not None
        and config.fallback_value > 0
        and quote.current < config.fallback_value * 0.5
    ):
        LOGGER.warning(
            "Discarding suspicious quote for %s: got %.2f but expected ~%.2f",
            config.symbol,
            quote.current,
            config.fallback_value,
        )
        quote = None
    if quote is None:
        LOGGER.warning(
            "Using last-resort fallback quote for %s because live market data providers "
            "returned no quote.",
            config.symbol,
        )
    value = quote.current if quote is not None else config.fallback_value
    change_pct = quote.change_pct if quote is not None else config.fallback_change_pct
    previous_close = (
        quote.previous_close
        if quote is not None
        else _previous_close_from_change(value, change_pct)
    )
    intraday = await _read_intraday_from_redis(config)
    is_fallback_data = intraday is None
    if intraday is None:
        LOGGER.warning(
            "No usable intraday candle series is available for %s after Redis and "
            "PostgreSQL fallback checks.",
            config.symbol,
        )
        intraday = []
    elif intraday:
        intraday_last = intraday[-1]
        use_intraday_value = (
            quote is None or quote.timestamp is None or intraday_last.timestamp >= quote.timestamp
        )
        if use_intraday_value:
            value = intraday_last.value
        if quote is None:
            previous_close = intraday[0].value
        if use_intraday_value and previous_close > 0:
            change_pct = ((value - previous_close) / previous_close) * 100
        elif use_intraday_value:
            first_value = intraday[0].value
            change_pct = (
                ((value - first_value) / first_value) * 100 if first_value > 0 else change_pct
            )
    if previous_close > 0 and value > 0 and abs(value - previous_close) / previous_close > 0.5:
        LOGGER.warning(
            "Suspicious previous_close for %s: value=%.2f, previous_close=%.2f. "
            "Falling back to estimated previous_close.",
            config.symbol,
            value,
            previous_close,
        )
        previous_close = _previous_close_from_change(value, config.fallback_change_pct)
        change_pct = config.fallback_change_pct
    if len(intraday) < 30:
        LOGGER.warning(
            "%s has only %s intraday chart points; charts may appear undersampled.",
            config.symbol,
            len(intraday),
        )
    sparkline_ranges = await _read_candle_ranges(config, value, change_pct)

    return MarketIndex(
        symbol=config.symbol,
        name=config.name,
        value=round(value, 2),
        previous_close=round(previous_close, 2),
        change_pct=round(change_pct, 2),
        market=config.market,
        currency=config.currency,
        is_trading=_is_trading(config),
        trading_hours=TradingHours(
            open=config.open_time.strftime("%H:%M"),
            close=config.close_time.strftime("%H:%M"),
            timezone=config.timezone,
            sessions=[
                TradingSession(
                    open=session_open.strftime("%H:%M"), close=session_close.strftime("%H:%M")
                )
                for session_open, session_close in config.sessions
            ],
            beijing_sessions=_sessions_to_beijing(config),
        ),
        sparkline_24h=[round(point.value, 2) for point in intraday],
        sparkline_times=[point.timestamp.isoformat() for point in intraday],
        sparkline_ranges=sparkline_ranges,
        is_fallback_data=is_fallback_data,
    )
