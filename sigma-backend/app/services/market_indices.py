import csv
import json
import logging
import math
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from urllib.parse import quote as quote_path
from zoneinfo import ZoneInfo

import httpx

from app.schemas.market import MarketIndex, MarketIndicesResponse, TradingHours, TradingSession
from app.utils.redis_lock import create_redis_client

CACHE_KEY = "sigma:market-indices"
ACTIVE_CACHE_TTL_SECONDS = 15
CLOSED_CACHE_TTL_SECONDS = 120
BEIJING_TZ = ZoneInfo("Asia/Shanghai")
LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class IndexConfig:
    symbol: str
    name: str
    market: str
    timezone: str
    sessions: tuple[tuple[time, time], ...]
    finnhub_symbol: str
    finnhub_proxy_symbol: str | None
    alpha_symbol: str
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


INDEX_CONFIGS: tuple[IndexConfig, ...] = (
    IndexConfig("SPX", "S&P 500", "us", "America/New_York", ((time(9, 30), time(16, 0)),), "^GSPC", "SPY", "SPY", "^spx", 5842.15, 0.41, "USD"),
    IndexConfig("IXIC", "Nasdaq Composite", "us", "America/New_York", ((time(9, 30), time(16, 0)),), "^IXIC", "QQQ", "QQQ", "^ndq", 18352.04, 0.56, "USD"),
    IndexConfig("DJI", "Dow Jones Industrial Average", "us", "America/New_York", ((time(9, 30), time(16, 0)),), "^DJI", "DIA", "DIA", "^dji", 40218.33, 0.24, "USD"),
    IndexConfig("SSE", "SSE Composite", "cn", "Asia/Shanghai", ((time(9, 30), time(11, 30)), (time(13, 0), time(15, 0))), "000001.SS", None, "000001.SHH", "^shc", 3138.92, -0.18, "CNY"),
    IndexConfig("HSI", "Hang Seng Index", "hk", "Asia/Hong_Kong", ((time(9, 30), time(12, 0)), (time(13, 0), time(16, 0))), "^HSI", None, "HSI", "^hsi", 19553.61, 0.32, "HKD"),
    IndexConfig("N225", "Nikkei 225", "jp", "Asia/Tokyo", ((time(9, 0), time(11, 30)), (time(12, 30), time(15, 30))), "^N225", None, "N225", "^nkx", 38570.76, -0.12, "JPY"),
    IndexConfig("FTSE", "FTSE 100", "eu", "Europe/London", ((time(8, 0), time(16, 30)),), "^FTSE", None, "FTSE", "^ukx", 8433.21, 0.21, "GBP"),
    IndexConfig("DAX", "DAX", "eu", "Europe/Berlin", ((time(9, 0), time(17, 30)),), "^GDAXI", None, "DAX", "^dax", 18772.85, 0.37, "EUR"),
    IndexConfig("KOSPI", "KOSPI", "kr", "Asia/Seoul", ((time(9, 0), time(15, 30)),), "^KS11", None, "KS11", "^kospi", 2650.30, 0.45, "KRW"),
    IndexConfig("TAIEX", "TAIEX", "tw", "Asia/Taipei", ((time(9, 0), time(13, 30)),), "^TWII", None, "TWII", "^twse", 20500.15, 0.28, "TWD"),
)


async def get_market_indices() -> MarketIndicesResponse:
    """Return cached market indices or refresh them when missing."""
    cached = await _cache_get()
    if cached is not None and _cached_payload_is_fresh(cached):
        return MarketIndicesResponse.model_validate_json(cached)
    return await refresh_market_indices(force=True)


async def refresh_market_indices(force: bool = False) -> MarketIndicesResponse:
    """Refresh index quotes and cache them for ticker consumers."""
    cached = await _cache_get()
    if cached is not None and not force and _cached_payload_is_fresh(cached):
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
    if quote is None:
        LOGGER.warning(
            "Using last-resort fallback quote for %s because live market data providers returned no quote.",
            config.symbol,
        )
    value = quote.current if quote is not None else config.fallback_value
    change_pct = quote.change_pct if quote is not None else config.fallback_change_pct
    previous_close = quote.previous_close if quote is not None else _previous_close_from_change(value, change_pct)
    intraday = await _fetch_intraday_series(config, value)
    if intraday is None:
        LOGGER.warning(
            "Using generated fallback intraday series for %s because live intraday providers returned no candles.",
            config.symbol,
        )
        intraday = _fallback_intraday_series(config, value, change_pct)
    elif quote is None and intraday:
        value = intraday[-1].value
        first_value = intraday[0].value
        change_pct = ((value - first_value) / first_value) * 100 if first_value > 0 else change_pct

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
        ),
        sparkline_24h=[round(point.value, 2) for point in intraday],
        sparkline_times=[point.timestamp.isoformat() for point in intraday],
    )


async def _fetch_index_quote(config: IndexConfig) -> IndexQuote | None:
    quote = await _fetch_finnhub_quote(config)
    if quote is not None:
        return quote
    quote = await _fetch_alpha_vantage_quote(config)
    if quote is not None:
        return quote
    quote = await _fetch_stooq_quote(config)
    if quote is not None:
        return quote
    return await _fetch_yahoo_quote(config)


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
            current = config.fallback_value * (1 + change_pct / 100)
            LOGGER.warning(
                "Using Finnhub proxy %s scaled from fallback base value for %s because the direct index quote is unavailable.",
                config.finnhub_proxy_symbol,
                config.symbol,
            )
            return IndexQuote(current=current, change_pct=change_pct, previous_close=config.fallback_value)
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
    except Exception:
        return None

    current = _as_float(payload.get("c"))
    previous = _as_float(payload.get("pc"))
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    return IndexQuote(current=current, change_pct=((current - previous) / previous) * 100, previous_close=previous)


async def _fetch_alpha_vantage_quote(config: IndexConfig) -> IndexQuote | None:
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
    except httpx.HTTPStatusError as exc:
        LOGGER.warning("Alpha Vantage quote request for %s failed with status %s.", config.symbol, exc.response.status_code)
        return None
    except httpx.HTTPError as exc:
        LOGGER.warning("Alpha Vantage quote request for %s failed: %s.", config.symbol, type(exc).__name__)
        return None
    except Exception:
        return None

    if not payload:
        LOGGER.warning("Alpha Vantage quote response for %s did not include Global Quote data.", config.symbol)
        return None

    current = _as_float(payload.get("05. price"))
    previous = _as_float(payload.get("08. previous close"))
    change_text = str(payload.get("10. change percent", "")).removesuffix("%")
    change_pct = _as_float(change_text)
    if current is None or change_pct is None or current <= 0:
        return None
    return IndexQuote(
        current=current,
        change_pct=change_pct,
        previous_close=previous if previous is not None and previous > 0 else _previous_close_from_change(current, change_pct),
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
    except Exception:
        return None

    rows = list(csv.DictReader(response.text.splitlines()))
    if not rows:
        return None
    current = _as_float(rows[0].get("Close"))
    previous = _as_float(rows[0].get("Prev"))
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    return IndexQuote(current=current, change_pct=((current - previous) / previous) * 100, previous_close=previous)


async def _fetch_yahoo_quote(config: IndexConfig) -> IndexQuote | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{quote_path(config.finnhub_symbol, safe='')}"
            )
            response.raise_for_status()
            result = response.json().get("chart", {}).get("result", [None])[0]
    except Exception:
        return None

    if not isinstance(result, dict):
        return None
    meta = result.get("meta", {})
    if not isinstance(meta, dict):
        return None

    current = _as_float(meta.get("regularMarketPrice"))
    previous = _as_float(meta.get("chartPreviousClose")) or _as_float(meta.get("previousClose"))
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    return IndexQuote(current=current, change_pct=((current - previous) / previous) * 100, previous_close=previous)


async def _fetch_intraday_series(config: IndexConfig, target_value: float) -> list[IntradayPoint] | None:
    finnhub_series = await _fetch_finnhub_intraday_series(config, target_value)
    if finnhub_series is not None:
        return finnhub_series
    alpha_series = await _fetch_alpha_vantage_intraday_series(config)
    if alpha_series is not None:
        return alpha_series
    return await _fetch_yahoo_intraday_series(config)


async def _fetch_finnhub_intraday_series(config: IndexConfig, target_value: float) -> list[IntradayPoint] | None:
    token = os.getenv("FINNHUB_KEY", "")
    if not token:
        return None

    session_date = _latest_session_date(config)
    start, end = _session_utc_bounds(config, session_date)
    direct = await _fetch_finnhub_candles(config.finnhub_symbol, token, start, end)
    if direct is not None:
        return _align_intraday_points(config, session_date, direct)
    if not config.finnhub_proxy_symbol:
        return None
    proxy = await _fetch_finnhub_candles(config.finnhub_proxy_symbol, token, start, end)
    if proxy is None:
        return None
    aligned = _align_intraday_points(config, session_date, proxy)
    if not aligned or aligned[-1].value <= 0:
        return None
    scale = target_value / aligned[-1].value
    return [IntradayPoint(timestamp=point.timestamp, value=point.value * scale) for point in aligned]


async def _fetch_finnhub_candles(
    symbol: str,
    token: str,
    start: datetime,
    end: datetime,
) -> list[IntradayPoint] | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://finnhub.io/api/v1/stock/candle",
                params={
                    "from": int(start.timestamp()),
                    "resolution": "1",
                    "symbol": symbol,
                    "to": int(end.timestamp()),
                    "token": token,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        LOGGER.warning("Finnhub candle request for %s failed with status %s.", symbol, exc.response.status_code)
        return None
    except httpx.HTTPError as exc:
        LOGGER.warning("Finnhub candle request for %s failed: %s.", symbol, type(exc).__name__)
        return None
    except Exception:
        return None

    if payload.get("s") != "ok":
        return None
    closes = payload.get("c")
    timestamps = payload.get("t")
    if not isinstance(closes, list) or not isinstance(timestamps, list) or len(closes) != len(timestamps):
        return None

    points: list[IntradayPoint] = []
    for timestamp, close in zip(timestamps, closes, strict=False):
        value = _as_float(close)
        epoch = _as_float(timestamp)
        if value is None or epoch is None or value <= 0:
            continue
        points.append(
            IntradayPoint(
                timestamp=datetime.fromtimestamp(epoch, tz=UTC).astimezone(BEIJING_TZ),
                value=value,
            )
        )
    return points or None


async def _fetch_alpha_vantage_intraday_series(config: IndexConfig) -> list[IntradayPoint] | None:
    token = os.getenv("ALPHAVANTAGE_KEY", "")
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://www.alphavantage.co/query",
                params={
                    "apikey": token,
                    "function": "TIME_SERIES_INTRADAY",
                    "interval": "1min",
                    "outputsize": "compact",
                    "symbol": config.alpha_symbol,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        LOGGER.warning("Alpha Vantage intraday request for %s failed with status %s.", config.symbol, exc.response.status_code)
        return None
    except httpx.HTTPError as exc:
        LOGGER.warning("Alpha Vantage intraday request for %s failed: %s.", config.symbol, type(exc).__name__)
        return None
    except Exception:
        return None

    series = payload.get("Time Series (1min)")
    if not isinstance(series, dict):
        LOGGER.warning("Alpha Vantage intraday response for %s did not include 1-minute time series data.", config.symbol)
        return None

    zone = ZoneInfo(config.timezone)
    points: list[IntradayPoint] = []
    for timestamp, values in series.items():
        if not isinstance(values, dict):
            continue
        value = _as_float(values.get("4. close"))
        if value is None or value <= 0:
            continue
        try:
            local_timestamp = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S").replace(tzinfo=zone)
        except ValueError:
            continue
        points.append(IntradayPoint(timestamp=local_timestamp.astimezone(BEIJING_TZ), value=value))

    if not points:
        return None
    session_date = _latest_session_date(config)
    return _align_intraday_points(config, session_date, points)


async def _fetch_yahoo_intraday_series(config: IndexConfig) -> list[IntradayPoint] | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{quote_path(config.finnhub_symbol, safe='')}",
                params={"includePrePost": "false", "interval": "1m", "range": "1d"},
            )
            response.raise_for_status()
            result = response.json().get("chart", {}).get("result", [None])[0]
    except Exception:
        return None

    if not isinstance(result, dict):
        return None
    timestamps = result.get("timestamp")
    indicators = result.get("indicators", {})
    if not isinstance(timestamps, list) or not isinstance(indicators, dict):
        return None
    quote_payload = indicators.get("quote", [None])[0]
    if not isinstance(quote_payload, dict):
        return None
    closes = quote_payload.get("close")
    if not isinstance(closes, list) or len(closes) != len(timestamps):
        return None

    points: list[IntradayPoint] = []
    for timestamp, close in zip(timestamps, closes, strict=False):
        value = _as_float(close)
        epoch = _as_float(timestamp)
        if value is None or epoch is None or value <= 0:
            continue
        points.append(
            IntradayPoint(
                timestamp=datetime.fromtimestamp(epoch, tz=UTC).astimezone(BEIJING_TZ),
                value=value,
            )
        )

    if not points:
        return None
    session_date = _latest_session_date(config)
    return _align_intraday_points(config, session_date, points)


def _is_trading(config: IndexConfig, now: datetime | None = None) -> bool:
    active_now = (now or _now_utc()).astimezone(ZoneInfo(config.timezone))
    if active_now.weekday() >= 5:
        return False
    current = active_now.time().replace(tzinfo=None)
    return any(session_open <= current < session_close for session_open, session_close in config.sessions)


def _fallback_intraday_series(config: IndexConfig, value: float, change_pct: float) -> list[IntradayPoint]:
    """Generate fallback prices over the exchange's actual trading minutes."""
    timestamps = _elapsed_trading_minutes(config, _latest_session_date(config))
    num_points = len(timestamps)
    start = value / (1 + change_pct / 100) if change_pct != -100 else value
    if num_points <= 1:
        return [IntradayPoint(timestamp=timestamps[0], value=round(value, 2))]
    points: list[float] = []
    for index in range(num_points):
        progress = index / (num_points - 1)
        curve = math.sin(progress * math.pi * 2) * value * 0.0008
        points.append(round(start + (value - start) * progress + curve, 2))
    return [
        IntradayPoint(timestamp=timestamp, value=point)
        for timestamp, point in zip(timestamps, points, strict=True)
    ]


def _align_intraday_points(
    config: IndexConfig,
    session_date: date,
    points: list[IntradayPoint],
) -> list[IntradayPoint] | None:
    if not points:
        return None

    values_by_minute = {
        point.timestamp.astimezone(BEIJING_TZ).replace(second=0, microsecond=0): point.value
        for point in points
    }
    first_value = next((point.value for point in sorted(points, key=lambda item: item.timestamp)), None)
    if first_value is None:
        return None

    aligned: list[IntradayPoint] = []
    last_value = first_value
    latest_point_time = max(values_by_minute)
    for timestamp in _trading_minutes(config, session_date):
        if timestamp > latest_point_time:
            break
        last_value = values_by_minute.get(timestamp, last_value)
        aligned.append(IntradayPoint(timestamp=timestamp, value=last_value))
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


def _session_utc_bounds(config: IndexConfig, session_date: date) -> tuple[datetime, datetime]:
    zone = ZoneInfo(config.timezone)
    start = datetime.combine(session_date, config.sessions[0][0], tzinfo=zone)
    end = datetime.combine(session_date, config.sessions[-1][1], tzinfo=zone)
    if config.sessions[-1][1] <= config.sessions[0][0]:
        end += timedelta(days=1)
    return start.astimezone(UTC), end.astimezone(UTC)


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
        await client.set(CACHE_KEY, value, ex=_market_cache_ttl_seconds())
    except Exception:
        return
    finally:
        await client.aclose()


def decode_cached_payload(value: str) -> dict[str, object]:
    """Decode a cached payload for focused unit tests."""
    return json.loads(value)
