from __future__ import annotations

import asyncio
import http.cookiejar
import json
import logging
import time as _time
import urllib.error
import urllib.request
from typing import TYPE_CHECKING, Any
from urllib.parse import quote as quote_path

from app.services.market.types import IndexQuote

if TYPE_CHECKING:
    from app.services.market.config import IndexConfig

LOGGER = logging.getLogger(__name__)
YAHOO_CHART_HOSTS = ("query1.finance.yahoo.com", "query2.finance.yahoo.com")
YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0",
}
YAHOO_MAX_BACKOFF_SECONDS = 120
YAHOO_CRUMB_TTL_SECONDS = 3600
YAHOO_INITIAL_BACKOFF_SECONDS = 30
YAHOO_CRUMB_HTTP_TIMEOUT_SECONDS = 5
YAHOO_CHART_HTTP_TIMEOUT_SECONDS = 10

_yahoo_semaphore = asyncio.Semaphore(2)
_yahoo_min_interval = 0.5
_yahoo_last_request_time = 0.0
_yahoo_backoff_until = 0.0
_yahoo_consecutive_429s = 0
_yahoo_meta_cache: dict[str, IndexQuote] = {}
_yahoo_crumb: str | None = None
_yahoo_cookie_jar: http.cookiejar.CookieJar | None = None
_yahoo_crumb_expires = 0.0
_yahoo_crumb_lock = asyncio.Lock()


async def _yahoo_rate_limit_wait() -> bool:
    """Wait for Yahoo rate-limit clearance, returning False while in backoff."""
    global _yahoo_consecutive_429s, _yahoo_last_request_time

    await _ensure_yahoo_crumb()
    now = _time.monotonic()
    if now < _yahoo_backoff_until:
        LOGGER.warning(
            "Yahoo backoff active, %.0fs remaining - candle fetch skipped.",
            _yahoo_backoff_until - now,
        )
        return False
    if _yahoo_consecutive_429s > 0 and now >= _yahoo_backoff_until:
        _yahoo_consecutive_429s = 0
    elapsed = now - _yahoo_last_request_time
    if elapsed < _yahoo_min_interval:
        await asyncio.sleep(_yahoo_min_interval - elapsed)
    _yahoo_last_request_time = _time.monotonic()
    return True


def _yahoo_on_429() -> None:
    """Record a Yahoo 429 response and open an exponential backoff window."""
    global _yahoo_backoff_until, _yahoo_consecutive_429s

    _yahoo_consecutive_429s += 1
    backoff = min(
        YAHOO_INITIAL_BACKOFF_SECONDS * (2 ** (_yahoo_consecutive_429s - 1)),
        YAHOO_MAX_BACKOFF_SECONDS,
    )
    _yahoo_backoff_until = _time.monotonic() + backoff
    LOGGER.warning("Yahoo 429 (#%d). Backing off %ds.", _yahoo_consecutive_429s, backoff)


def _yahoo_on_success() -> None:
    """Reset Yahoo backoff state after a successful response."""
    global _yahoo_consecutive_429s

    if _yahoo_consecutive_429s > 0:
        LOGGER.info("Yahoo OK, resetting backoff from %d.", _yahoo_consecutive_429s)
    _yahoo_consecutive_429s = 0


async def _ensure_yahoo_crumb() -> None:
    """Ensure the shared Yahoo crumb and cookie jar are initialized."""
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
            opener.open(fc_request, timeout=YAHOO_CRUMB_HTTP_TIMEOUT_SECONDS)
        except urllib.error.HTTPError:
            pass
        except Exception:
            pass
        crumb_request = urllib.request.Request(
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
            headers=YAHOO_HEADERS,
        )
        with opener.open(crumb_request, timeout=YAHOO_CRUMB_HTTP_TIMEOUT_SECONDS) as response:
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
) -> dict[str, Any] | None:
    """Fetch one Yahoo chart response with shared throttling and backoff."""
    async with _yahoo_semaphore:
        if not await _yahoo_rate_limit_wait():
            return None

        symbol_path = quote_path(config.finnhub_symbol, safe="")

        for host in YAHOO_CHART_HOSTS:
            query_string = "&".join(f"{key}={value}" for key, value in params.items())
            url = f"https://{host}/v8/finance/chart/{symbol_path}?{query_string}"
            try:
                result = await asyncio.to_thread(
                    _yahoo_urllib_fetch, url, purpose, config.finnhub_symbol, host
                )
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
                    purpose,
                    config.finnhub_symbol,
                    host,
                    type(exc).__name__,
                    exc,
                )
                continue
    return None


def _yahoo_urllib_fetch(
    url: str, purpose: str, symbol: str, host: str
) -> dict[str, Any] | str | None:
    """Synchronously fetch Yahoo data with urllib to avoid TLS fingerprint blocking."""
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
        resp = opener.open(req, timeout=YAHOO_CHART_HTTP_TIMEOUT_SECONDS)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            _yahoo_crumb = None
        if exc.code == 429:
            return "_429"
        LOGGER.warning(
            "Yahoo %s chart request for %s via %s failed: HTTP %s",
            purpose,
            symbol,
            host,
            exc.code,
        )
        return None
    except Exception as exc:
        LOGGER.warning(
            "Yahoo %s chart request for %s via %s failed: %s: %s",
            purpose,
            symbol,
            host,
            type(exc).__name__,
            exc,
        )
        return None

    try:
        payload = json.loads(resp.read())
    except Exception:
        LOGGER.warning(
            "Yahoo %s chart response for %s via %s was not valid JSON.", purpose, symbol, host
        )
        return None

    chart = payload.get("chart")
    if not isinstance(chart, dict):
        LOGGER.warning(
            "Yahoo %s chart response for %s via %s did not include chart data.",
            purpose,
            symbol,
            host,
        )
        return None
    error = chart.get("error")
    if error:
        LOGGER.warning(
            "Yahoo %s chart response for %s via %s returned error: %s", purpose, symbol, host, error
        )
        return None
    result = chart.get("result")
    if isinstance(result, list) and result and isinstance(result[0], dict):
        return result[0]
    LOGGER.warning(
        "Yahoo %s chart response for %s via %s did not include result data.", purpose, symbol, host
    )
    return None


def _as_float(value: Any) -> float | None:
    """Convert provider payload values to floats when possible."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
