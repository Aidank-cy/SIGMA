import asyncio
import csv
import http.cookiejar
import json
import logging
import os
import time as _time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from urllib.parse import quote as quote_path
from zoneinfo import ZoneInfo

import httpx

from app.schemas.market import MarketIndex, MarketIndicesResponse, MarketSparkline, TradingHours, TradingSession
from app.utils.redis_lock import create_redis_client

CACHE_KEY = "sigma:market-indices"
ACTIVE_CACHE_TTL_SECONDS = 15
CLOSED_CACHE_TTL_SECONDS = 120
STALE_CACHE_TTL_SECONDS = 300
MARKET_INDEX_REFRESH_DELAY_SECONDS = 0.6
BEIJING_TZ = ZoneInfo("Asia/Shanghai")
LOGGER = logging.getLogger(__name__)
YAHOO_CHART_HOSTS = ("query1.finance.yahoo.com", "query2.finance.yahoo.com")
YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0",
}
_yahoo_semaphore = asyncio.Semaphore(2)
_yahoo_min_interval = 0.5
_yahoo_last_request_time = 0.0
_yahoo_backoff_until = 0.0
_yahoo_consecutive_429s = 0
_yahoo_meta_cache: dict[str, "IndexQuote"] = {}
_yahoo_crumb: str | None = None
_yahoo_cookie_jar: http.cookiejar.CookieJar | None = None
_yahoo_crumb_expires = 0.0
_yahoo_crumb_lock = asyncio.Lock()
YAHOO_MAX_BACKOFF_SECONDS = 120
YAHOO_CRUMB_TTL_SECONDS = 3600


@dataclass(frozen=True)
class IndexConfig:
    symbol: str
    name: str
    market: str
    timezone: str
    sessions: tuple[tuple[time, time], ...]
    finnhub_symbol: str
    finnhub_proxy_symbol: str | None
    stooq_symbol: str | None
    fallback_value: float
    fallback_change_pct: float
    currency: str

    @property
    def open_time(self) -> time:
        return self.sessions[0][0]

    @property
    def close_time(self) -> time:
        return self.sessions[-1][1]


@dataclass(frozen=True)
class IntradayPoint:
    timestamp: datetime
    value: float


@dataclass(frozen=True)
class IndexQuote:
    current: float
    change_pct: float
    previous_close: float
    timestamp: datetime | None = None


INDEX_CONFIGS: tuple[IndexConfig, ...] = (
    IndexConfig("SPX", "S&P 500", "us", "America/New_York", ((time(9, 30), time(16, 0)),), "^GSPC", "SPY", "^spx", 7500.00, 0.40, "USD"),
    IndexConfig("IXIC", "Nasdaq Composite", "us", "America/New_York", ((time(9, 30), time(16, 0)),), "^IXIC", "QQQ", "^ndq", 26500.00, 0.50, "USD"),
    IndexConfig("DJI", "Dow Jones Industrial Average", "us", "America/New_York", ((time(9, 30), time(16, 0)),), "^DJI", "DIA", "^dji", 50500.00, 0.25, "USD"),
    IndexConfig("SSE", "SSE Composite", "cn", "Asia/Shanghai", ((time(9, 30), time(11, 30)), (time(13, 0), time(15, 0))), "000001.SS", None, "^shc", 4150.00, 0.20, "CNY"),
    IndexConfig("HSI", "Hang Seng Index", "hk", "Asia/Hong_Kong", ((time(9, 30), time(12, 0)), (time(13, 0), time(16, 0))), "^HSI", None, "^hsi", 25600.00, 0.30, "HKD"),
    IndexConfig("N225", "Nikkei 225", "jp", "Asia/Tokyo", ((time(9, 0), time(11, 30)), (time(12, 30), time(15, 30))), "^N225", None, "^nkx", 64900.00, 0.20, "JPY"),
    IndexConfig("FTSE", "FTSE 100", "eu", "Europe/London", ((time(8, 0), time(16, 30)),), "^FTSE", "EWU", "^ukx", 10450.00, 0.20, "GBP"),
    IndexConfig("DAX", "DAX", "eu", "Europe/Berlin", ((time(9, 0), time(17, 30)),), "^GDAXI", "EWG", "^dax", 25400.00, 0.35, "EUR"),
    IndexConfig("KOSPI", "KOSPI", "kr", "Asia/Seoul", ((time(9, 0), time(15, 30)),), "^KS11", None, "^kospi", 8050.00, 0.45, "KRW"),
    IndexConfig("TAIEX", "TAIEX", "tw", "Asia/Taipei", ((time(9, 0), time(13, 30)),), "^TWII", None, "^twse", 43500.00, 0.30, "TWD"),
)


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
            LOGGER.warning("Returning stale market-index cache while the scheduler refreshes provider data.")
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


def any_market_trading_now(now: datetime | None = None) -> bool:
    """Return whether any configured exchange is inside regular trading hours."""
    return any(_is_trading(config, now) for config in INDEX_CONFIGS)


async def _build_index(config: IndexConfig) -> MarketIndex:
    quote = await _fetch_index_quote(config)
    if quote is None:
        quote = await _quote_from_redis_candle(config)
    if quote is not None and config.fallback_value > 0 and quote.current < config.fallback_value * 0.5:
        LOGGER.warning(
            "Discarding suspicious quote for %s: got %.2f but expected ~%.2f",
            config.symbol,
            quote.current,
            config.fallback_value,
        )
        quote = None
    if quote is None:
        LOGGER.warning(
            "Using last-resort fallback quote for %s because live market data providers returned no quote.",
            config.symbol,
        )
    value = quote.current if quote is not None else config.fallback_value
    change_pct = quote.change_pct if quote is not None else config.fallback_change_pct
    previous_close = quote.previous_close if quote is not None else _previous_close_from_change(value, change_pct)
    intraday = await _read_intraday_from_redis(config)
    is_fallback_data = intraday is None
    if intraday is None:
        LOGGER.warning(
            "No usable intraday candle series is available for %s after Redis and PostgreSQL fallback checks.",
            config.symbol,
        )
        intraday = []
    elif intraday:
        intraday_last = intraday[-1]
        use_intraday_value = quote is None or quote.timestamp is None or intraday_last.timestamp >= quote.timestamp
        if use_intraday_value:
            value = intraday_last.value
        if quote is None:
            previous_close = intraday[0].value
        if use_intraday_value and previous_close > 0:
            change_pct = ((value - previous_close) / previous_close) * 100
        elif use_intraday_value:
            first_value = intraday[0].value
            change_pct = ((value - first_value) / first_value) * 100 if first_value > 0 else change_pct
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
                TradingSession(open=session_open.strftime("%H:%M"), close=session_close.strftime("%H:%M"))
                for session_open, session_close in config.sessions
            ],
            beijing_sessions=_sessions_to_beijing(config),
        ),
        sparkline_24h=[round(point.value, 2) for point in intraday],
        sparkline_times=[point.timestamp.isoformat() for point in intraday],
        sparkline_ranges=sparkline_ranges,
        is_fallback_data=is_fallback_data,
    )


async def _fetch_index_quote(config: IndexConfig) -> IndexQuote | None:
    cached = _yahoo_meta_cache.get(config.symbol)
    if cached is not None:
        return cached
    quote = await _fetch_finnhub_quote(config)
    if quote is not None:
        return quote
    return await _fetch_stooq_quote(config)


async def _fetch_finnhub_quote(config: IndexConfig) -> IndexQuote | None:
    token = os.getenv("FINNHUB_KEY", "")
    if not token:
        return None
    quote = await _fetch_finnhub_symbol_quote(config.finnhub_symbol, token)
    if quote is not None:
        return quote
    if config.finnhub_proxy_symbol:
        proxy_quote = await _fetch_finnhub_symbol_quote(config.finnhub_proxy_symbol, token)
        if proxy_quote is not None:
            change_pct = proxy_quote.change_pct
            base_value = config.fallback_value
            redis_quote = await _quote_from_redis_candle(config)
            if redis_quote is not None and redis_quote.current > 0 and redis_quote.previous_close > 0:
                base_value = redis_quote.previous_close
            current = base_value * (1 + change_pct / 100)
            LOGGER.warning(
                "Using Finnhub proxy %s scaled from %.2f base value for %s because the direct index quote is unavailable.",
                config.finnhub_proxy_symbol,
                base_value,
                config.symbol,
            )
            return IndexQuote(
                current=current,
                change_pct=change_pct,
                previous_close=base_value,
                timestamp=proxy_quote.timestamp,
            )
    return None


async def _fetch_finnhub_symbol_quote(symbol: str, token: str) -> IndexQuote | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://finnhub.io/api/v1/quote",
                params={"symbol": symbol, "token": token},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        LOGGER.warning("Finnhub quote request for %s failed with status %s.", symbol, exc.response.status_code)
        return None
    except httpx.HTTPError as exc:
        LOGGER.warning("Finnhub quote request for %s failed: %s.", symbol, type(exc).__name__)
        return None
    except Exception as exc:
        LOGGER.warning("Finnhub quote request for %s failed: %s: %s.", symbol, type(exc).__name__, exc)
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
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://stooq.com/q/l/",
                params={"e": "csv", "f": "sd2t2ohlcvp", "h": "", "s": config.stooq_symbol},
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        LOGGER.warning("Stooq quote request for %s failed with status %s.", config.symbol, exc.response.status_code)
        return None
    except httpx.HTTPError as exc:
        LOGGER.warning("Stooq quote request for %s failed: %s: %s.", config.symbol, type(exc).__name__, exc)
        return None
    except Exception as exc:
        LOGGER.warning("Stooq quote request for %s failed: %s: %s.", config.symbol, type(exc).__name__, exc)
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
    from app.services.market_candles import _redis_get_1d

    points = await _redis_get_1d(config.symbol)
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


async def _read_intraday_from_redis(config: IndexConfig) -> list[IntradayPoint] | None:
    """Read the latest session's 1-minute candle data from Redis, falling back to 5D Redis then PG."""
    from app.services.market_candles import _pg_get_candles, _redis_get_1d, _redis_get_5d

    points = await _redis_get_1d(config.symbol)
    if not points:
        # Try 5D Redis first — it often has today's 1-min data merged in.
        five_day = await _redis_get_5d(config.symbol)
        if five_day:
            session_date = _latest_session_date(config)
            zone = ZoneInfo(config.timezone)
            session_points = [
                point for point in five_day if point.timestamp.astimezone(zone).date() == session_date
            ]
            if len(session_points) >= 10:
                points = session_points
            else:
                latest_date = five_day[-1].timestamp.astimezone(zone).date()
                latest_points = [
                    point for point in five_day if point.timestamp.astimezone(zone).date() == latest_date
                ]
                if len(latest_points) >= 10:
                    points = latest_points
    if not points:
        pg_points = await _pg_get_candles(config.symbol, "15m", limit=100)
        if pg_points and len(pg_points) >= 5:
            session_date = _latest_session_date(config)
            zone = ZoneInfo(config.timezone)
            session_points = [
                point for point in pg_points if point.timestamp.astimezone(zone).date() == session_date
            ]
            if len(session_points) >= 5:
                return session_points
            latest_date = pg_points[-1].timestamp.astimezone(zone).date()
            latest_points = [
                point for point in pg_points if point.timestamp.astimezone(zone).date() == latest_date
            ]
            if len(latest_points) >= 5:
                return latest_points
        return None

    now = _now_utc()
    if not _is_trading(config, now) and len(points) < 30:
        five_day = await _redis_get_5d(config.symbol)
        if five_day:
            session_date = _latest_session_date(config)
            zone = ZoneInfo(config.timezone)
            session_points = [
                point for point in five_day if point.timestamp.astimezone(zone).date() == session_date
            ]
            if len(session_points) >= 30:
                points = session_points
            else:
                latest_date = five_day[-1].timestamp.astimezone(zone).date()
                latest_points = [
                    point for point in five_day if point.timestamp.astimezone(zone).date() == latest_date
                ]
                if len(latest_points) >= 30:
                    points = latest_points

    if not _is_trading(config, now):
        if len(points) < 10:
            return None
        return points

    session_date = _latest_session_date(config)
    zone = ZoneInfo(config.timezone)
    current_session_points = [
        point for point in points if point.timestamp.astimezone(zone).date() == session_date
    ]
    return current_session_points if len(current_session_points) >= 10 else None

async def _yahoo_rate_limit_wait() -> bool:
    """Wait for Yahoo rate-limit clearance, returning False while in backoff."""
    global _yahoo_consecutive_429s, _yahoo_last_request_time

    await _ensure_yahoo_crumb()
    now = _time.monotonic()
    if now < _yahoo_backoff_until:
        LOGGER.warning("Yahoo backoff active, %.0fs remaining — candle fetch skipped.", _yahoo_backoff_until - now)
        return False
    if _yahoo_consecutive_429s > 0 and now >= _yahoo_backoff_until:
        _yahoo_consecutive_429s = 0
    elapsed = now - _yahoo_last_request_time
    if elapsed < _yahoo_min_interval:
        await asyncio.sleep(_yahoo_min_interval - elapsed)
    _yahoo_last_request_time = _time.monotonic()
    return True


def _yahoo_on_429() -> None:
    global _yahoo_backoff_until, _yahoo_consecutive_429s

    _yahoo_consecutive_429s += 1
    backoff = min(30 * (2 ** (_yahoo_consecutive_429s - 1)), YAHOO_MAX_BACKOFF_SECONDS)
    _yahoo_backoff_until = _time.monotonic() + backoff
    LOGGER.warning("Yahoo 429 (#%d). Backing off %ds.", _yahoo_consecutive_429s, backoff)


def _yahoo_on_success() -> None:
    global _yahoo_consecutive_429s

    if _yahoo_consecutive_429s > 0:
        LOGGER.info("Yahoo OK, resetting backoff from %d.", _yahoo_consecutive_429s)
    _yahoo_consecutive_429s = 0


async def _ensure_yahoo_crumb() -> None:
    if _yahoo_crumb and _time.monotonic() < _yahoo_crumb_expires:
        return
    try:
        async with _yahoo_crumb_lock:
            if _yahoo_crumb and _time.monotonic() < _yahoo_crumb_expires:
                return
            await asyncio.to_thread(_ensure_yahoo_crumb_sync)
    except asyncio.CancelledError:
        LOGGER.warning("Yahoo crumb fetch was cancelled; continuing without crumb.")
    except Exception as exc:
        LOGGER.warning(
            "Yahoo crumb fetch failed: %s: %s; continuing without crumb.",
            type(exc).__name__,
            exc,
        )


def _ensure_yahoo_crumb_sync() -> None:
    """Fetch Yahoo cookie and crumb for chart API requests."""
    global _yahoo_cookie_jar, _yahoo_crumb, _yahoo_crumb_expires

    if _yahoo_crumb and _time.monotonic() < _yahoo_crumb_expires:
        return

    try:
        cookie_jar = http.cookiejar.MozillaCookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
        fc_request = urllib.request.Request("https://fc.yahoo.com/", headers=YAHOO_HEADERS)
        try:
            opener.open(fc_request, timeout=5)
        except urllib.error.HTTPError:
            pass
        except Exception:
            pass
        crumb_request = urllib.request.Request(
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
            headers=YAHOO_HEADERS,
        )
        with opener.open(crumb_request, timeout=5) as response:
            crumb = response.read().decode("utf-8").strip()
    except Exception as exc:
        LOGGER.warning("Yahoo crumb fetch failed: %s: %s", type(exc).__name__, exc)
        return

    if not crumb:
        LOGGER.warning("Yahoo crumb fetch returned an empty crumb.")
        return

    _yahoo_cookie_jar = cookie_jar
    _yahoo_crumb = crumb
    _yahoo_crumb_expires = _time.monotonic() + YAHOO_CRUMB_TTL_SECONDS
    LOGGER.info("Yahoo crumb obtained successfully.")


async def _fetch_yahoo_chart_result(
    config: IndexConfig,
    params: dict[str, str],
    purpose: str,
) -> dict[str, object] | None:
    async with _yahoo_semaphore:
        if not await _yahoo_rate_limit_wait():
            return None

        symbol_path = quote_path(config.finnhub_symbol, safe="")

        for host in YAHOO_CHART_HOSTS:
            query_string = "&".join(f"{k}={v}" for k, v in params.items())
            url = f"https://{host}/v8/finance/chart/{symbol_path}?{query_string}"
            try:
                result = await asyncio.to_thread(_yahoo_urllib_fetch, url, purpose, config.finnhub_symbol, host)
                if result == "_429":
                    _yahoo_on_429()
                    return None
                if result is not None:
                    _yahoo_on_success()
                    meta = result.get("meta", {})
                    if isinstance(meta, dict):
                        rmp = _as_float(meta.get("regularMarketPrice"))
                        cpc = _as_float(meta.get("chartPreviousClose"))
                        if rmp is not None and rmp > 0 and cpc is not None and cpc > 0:
                            _yahoo_meta_cache[config.symbol] = IndexQuote(
                                current=rmp,
                                change_pct=((rmp - cpc) / cpc) * 100,
                                previous_close=cpc,
                            )
                    return result
            except Exception as exc:
                LOGGER.warning(
                    "Yahoo %s chart request for %s via %s failed: %s: %s",
                    purpose, config.finnhub_symbol, host, type(exc).__name__, exc,
                )
                continue
    return None


def _yahoo_urllib_fetch(url: str, purpose: str, symbol: str, host: str) -> dict[str, object] | str | None:
    """Synchronous Yahoo fetch using urllib to avoid httpx TLS fingerprint blocking."""
    global _yahoo_crumb

    fetch_url = url
    if _yahoo_crumb:
        separator = "&" if "?" in fetch_url else "?"
        fetch_url = f"{fetch_url}{separator}crumb={quote_path(_yahoo_crumb, safe='')}"
    req = urllib.request.Request(fetch_url, headers=YAHOO_HEADERS)
    opener = (
        urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_yahoo_cookie_jar))
        if _yahoo_cookie_jar is not None
        else urllib.request.build_opener()
    )
    try:
        resp = opener.open(req, timeout=10)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            _yahoo_crumb = None
        if exc.code == 429:
            return "_429"
        LOGGER.warning(
            "Yahoo %s chart request for %s via %s failed: HTTP %s",
            purpose, symbol, host, exc.code,
        )
        return None
    except Exception as exc:
        LOGGER.warning(
            "Yahoo %s chart request for %s via %s failed: %s: %s",
            purpose, symbol, host, type(exc).__name__, exc,
        )
        return None

    try:
        payload = json.loads(resp.read())
    except Exception:
        LOGGER.warning("Yahoo %s chart response for %s via %s was not valid JSON.", purpose, symbol, host)
        return None

    chart = payload.get("chart")
    if not isinstance(chart, dict):
        LOGGER.warning("Yahoo %s chart response for %s via %s did not include chart data.", purpose, symbol, host)
        return None
    error = chart.get("error")
    if error:
        LOGGER.warning("Yahoo %s chart response for %s via %s returned error: %s", purpose, symbol, host, error)
        return None
    result = chart.get("result")
    if isinstance(result, list) and result and isinstance(result[0], dict):
        return result[0]
    LOGGER.warning("Yahoo %s chart response for %s via %s did not include result data.", purpose, symbol, host)
    return None


async def _read_candle_ranges(
    config: IndexConfig,
    value: float,
    change_pct: float,
) -> dict[str, MarketSparkline]:
    """Read chart range candles from Redis and PostgreSQL without fetching Yahoo."""
    from app.services.market_candles import _pg_get_candles, _redis_get_5d

    ranges: dict[str, MarketSparkline] = {}

    data_5d = await _redis_get_5d(config.symbol)
    if not data_5d:
        pg_15m = await _pg_get_candles(config.symbol, "15m", limit=600)
        if pg_15m and len(pg_15m) >= 10:
            data_5d = pg_15m
    if data_5d:
        ranges["5D"] = MarketSparkline(
            values=[round(point.value, 2) for point in data_5d],
            times=[point.timestamp.isoformat() for point in data_5d],
        )
    else:
        ranges["5D"] = MarketSparkline(values=[], times=[])

    for range_key, interval, limit, _fallback_points in (
        ("1M", "15m", 600, 22),
        ("3M", "60m", 500, 66),
        ("1Y", "60m", 1800, 252),
    ):
        series = await _pg_get_candles(config.symbol, interval, limit=limit)
        ranges[range_key] = MarketSparkline(
            values=[round(point.value, 2) for point in series],
            times=[point.timestamp.isoformat() for point in series],
        )
    return ranges


def _market_status_beijing(config: IndexConfig, now_beijing: datetime) -> str:
    """Return not_opened, trading, or closed using the market clock observed from Beijing."""
    local_now = now_beijing.astimezone(ZoneInfo(config.timezone))
    if local_now.weekday() >= 5:
        return "closed"

    current = local_now.time().replace(tzinfo=None)
    if any(_time_in_session(current, session_open, session_close) for session_open, session_close in config.sessions):
        return "trading"
    if any(current < session_open for session_open, _session_close in config.sessions):
        return "not_opened"
    return "closed"


def _is_trading(config: IndexConfig, now: datetime | None = None) -> bool:
    active_now = (now or _now_utc()).astimezone(ZoneInfo(config.timezone))
    if active_now.weekday() >= 5:
        return False
    current = active_now.time().replace(tzinfo=None)
    return any(_time_in_session(current, session_open, session_close) for session_open, session_close in config.sessions)


def _is_within_session(timestamp: datetime, config: IndexConfig) -> bool:
    local = timestamp.astimezone(ZoneInfo(config.timezone))
    if local.weekday() >= 5:
        return False
    current = local.time().replace(tzinfo=None)
    return any(_time_in_session(current, session_open, session_close) for session_open, session_close in config.sessions)


def _time_in_session(current: time, session_open: time, session_close: time) -> bool:
    if session_close <= session_open:
        return current >= session_open or current <= session_close
    return session_open <= current <= session_close


def _sessions_to_beijing(config: IndexConfig) -> list[TradingSession]:
    """Convert a market's latest exchange sessions to Beijing wall-clock labels."""
    session_date = _latest_session_date(config)
    zone = ZoneInfo(config.timezone)
    beijing_sessions: list[TradingSession] = []
    for session_open, session_close in config.sessions:
        open_local = datetime.combine(session_date, session_open, tzinfo=zone)
        close_local = datetime.combine(session_date, session_close, tzinfo=zone)
        if session_close <= session_open:
            close_local += timedelta(days=1)
        open_beijing = open_local.astimezone(BEIJING_TZ)
        close_beijing = close_local.astimezone(BEIJING_TZ)
        beijing_sessions.append(
            TradingSession(
                open=open_beijing.strftime("%H:%M"),
                close=close_beijing.strftime("%H:%M"),
            )
        )
    return beijing_sessions


def _align_intraday_points(
    config: IndexConfig,
    session_date: date,
    points: list[IntradayPoint],
) -> list[IntradayPoint] | None:
    if not points:
        return None

    session_points = [point for point in points if _is_within_session(point.timestamp, config)]
    if not session_points:
        return None

    values_by_minute = {
        point.timestamp.astimezone(BEIJING_TZ).replace(second=0, microsecond=0): point.value
        for point in session_points
    }
    first_value = next((point.value for point in sorted(session_points, key=lambda item: item.timestamp)), None)
    if first_value is None:
        return None

    aligned: list[IntradayPoint] = []
    last_value = first_value
    latest_point_time = max(values_by_minute)
    forward_filled_count = 0
    for timestamp in _trading_minutes(config, session_date):
        if timestamp > latest_point_time:
            break
        next_value = values_by_minute.get(timestamp)
        if next_value is None:
            forward_filled_count += 1
        else:
            last_value = next_value
        aligned.append(IntradayPoint(timestamp=timestamp, value=last_value))
    if aligned:
        forward_fill_ratio = forward_filled_count / len(aligned)
        if forward_fill_ratio > 0.3:
            LOGGER.warning(
                "%s intraday alignment forward-filled %.1f%% of %s chart points; upstream data may be too sparse.",
                config.symbol,
                forward_fill_ratio * 100,
                len(aligned),
            )
    return aligned or None


def _trading_minutes(config: IndexConfig, session_date: date) -> list[datetime]:
    zone = ZoneInfo(config.timezone)
    timestamps: list[datetime] = []
    for session_open, session_close in config.sessions:
        start = datetime.combine(session_date, session_open, tzinfo=zone)
        end = datetime.combine(session_date, session_close, tzinfo=zone)
        if session_close <= session_open:
            end += timedelta(days=1)
        current = start
        while current <= end:
            timestamps.append(current.astimezone(BEIJING_TZ).replace(second=0, microsecond=0))
            current += timedelta(minutes=1)
    return timestamps


def _latest_session_date(config: IndexConfig, now: datetime | None = None) -> date:
    local_now = (now or _now_utc()).astimezone(ZoneInfo(config.timezone))
    session_date = local_now.date()
    if local_now.time().replace(tzinfo=None) < config.open_time:
        session_date -= timedelta(days=1)
    while session_date.weekday() >= 5:
        session_date -= timedelta(days=1)
    return session_date


def _elapsed_trading_minutes(config: IndexConfig, session_date: date, now: datetime | None = None) -> list[datetime]:
    timestamps = _trading_minutes(config, session_date)
    local_now = (now or _now_utc()).astimezone(ZoneInfo(config.timezone))
    if local_now.date() != session_date or local_now.time().replace(tzinfo=None) >= config.close_time:
        return timestamps
    cutoff = local_now.astimezone(BEIJING_TZ).replace(second=0, microsecond=0)
    elapsed = [timestamp for timestamp in timestamps if timestamp <= cutoff]
    return elapsed or timestamps[:1]


def _previous_close_from_change(value: float, change_pct: float) -> float:
    if change_pct == -100:
        return value
    previous = value / (1 + change_pct / 100)
    return previous if previous > 0 else value


def _market_cache_ttl_seconds(now: datetime | None = None) -> int:
    return ACTIVE_CACHE_TTL_SECONDS if any_market_trading_now(now) else CLOSED_CACHE_TTL_SECONDS


def _market_cache_expiration_seconds(now: datetime | None = None) -> int:
    return max(_market_cache_ttl_seconds(now), STALE_CACHE_TTL_SECONDS)


def _cached_payload_is_fresh(value: str, now: datetime | None = None) -> bool:
    try:
        response = MarketIndicesResponse.model_validate_json(value)
    except Exception:
        return False
    current = now or _now_utc()
    age = current - response.updated_at
    return age <= timedelta(seconds=_market_cache_ttl_seconds(current))


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _as_float(value: object) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _timestamp_from_epoch(value: object) -> datetime | None:
    epoch = _as_float(value)
    if epoch is None or epoch <= 0:
        return None
    return datetime.fromtimestamp(epoch, tz=UTC)


def _timestamp_from_exchange_fields(config: IndexConfig, date_value: object, time_value: object) -> datetime | None:
    date_text = str(date_value or "").strip()
    time_text = str(time_value or "").strip()
    if not date_text or not time_text or date_text.upper() == "N/D" or time_text.upper() == "N/D":
        return None
    try:
        local_date = date.fromisoformat(date_text)
        time_parts = time_text.split(":")
        local_time = time(
            hour=int(time_parts[0]),
            minute=int(time_parts[1]) if len(time_parts) > 1 else 0,
            second=int(time_parts[2]) if len(time_parts) > 2 else 0,
        )
    except (TypeError, ValueError):
        return None
    return datetime.combine(local_date, local_time, tzinfo=ZoneInfo(config.timezone))


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
        await client.set(CACHE_KEY, value, ex=_market_cache_expiration_seconds())
    except Exception:
        return
    finally:
        await client.aclose()


def decode_cached_payload(value: str) -> dict[str, object]:
    """Decode a cached payload for focused unit tests."""
    return json.loads(value)
