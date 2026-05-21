from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.api.v1.routes.market_indices import list_market_indices
from app.scheduler.engine import add_market_indices_job, scheduler
from app.scheduler.jobs import refresh_market_indices_job
from app.services import market_indices


@pytest.mark.asyncio
async def test_market_indices_endpoint_returns_supported_indices(monkeypatch: pytest.MonkeyPatch) -> None:
    """Market indices endpoint returns all configured global indices."""
    cache: dict[str, str] = {}

    async def fake_cache_get() -> str | None:
        return cache.get("payload")

    async def fake_cache_set(value: str) -> None:
        cache["payload"] = value

    async def fake_quote(_config: market_indices.IndexConfig) -> None:
        return None

    async def fake_intraday(_config: market_indices.IndexConfig, _value: float) -> None:
        return None

    async def fake_historical(
        _config: market_indices.IndexConfig,
        value: float,
        _change_pct: float,
    ) -> dict[str, market_indices.MarketSparkline]:
        return {
            range_key: market_indices.MarketSparkline(
                values=[value, value + 1],
                times=["2026-05-18T16:00:00+08:00", "2026-05-19T16:00:00+08:00"],
            )
            for range_key in market_indices.HISTORICAL_RANGES
        }

    async def fake_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(market_indices, "_cache_get", fake_cache_get)
    monkeypatch.setattr(market_indices, "_cache_set", fake_cache_set)
    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)
    monkeypatch.setattr(market_indices, "_fetch_intraday_series", fake_intraday)
    monkeypatch.setattr(market_indices, "_read_cached_historical_ranges", fake_historical)
    monkeypatch.setattr(market_indices.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 22, 30, tzinfo=UTC))

    response = await list_market_indices()

    assert response.updated_at == datetime(2026, 5, 18, 22, 30, tzinfo=UTC)
    assert {index.symbol for index in response.indices} == {
        "SPX",
        "IXIC",
        "DJI",
        "SSE",
        "HSI",
        "N225",
        "FTSE",
        "DAX",
        "KOSPI",
        "TAIEX",
    }
    lengths = {index.symbol: len(index.sparkline_24h) for index in response.indices}
    assert lengths["SSE"] == 242
    assert lengths["HSI"] == 332
    assert lengths["N225"] == 332
    assert all(len(index.sparkline_24h) == len(index.sparkline_times) for index in response.indices)
    assert all(index.is_fallback_data is True for index in response.indices)
    assert {index.symbol: index.currency for index in response.indices}["SPX"] == "USD"
    assert {index.symbol: index.currency for index in response.indices}["SSE"] == "CNY"
    assert set(response.indices[0].sparkline_ranges) == {"5D", "1M", "3M", "1Y"}
    assert response.indices[0].sparkline_ranges["5D"].times[0] == "2026-05-18T16:00:00+08:00"
    assert all(index.previous_close > 0 for index in response.indices)
    sse = next(index for index in response.indices if index.symbol == "SSE")
    assert [session.open for session in sse.trading_hours.sessions] == ["09:30", "13:00"]
    spx = next(index for index in response.indices if index.symbol == "SPX")
    assert spx.trading_hours.beijing_sessions[0].open == "21:30"
    assert spx.trading_hours.beijing_sessions[0].close == "04:00"
    assert sse.sparkline_times[0].endswith("09:30:00+08:00")
    assert sse.sparkline_times[120].endswith("11:30:00+08:00")
    assert sse.sparkline_times[121].endswith("13:00:00+08:00")
    assert market_indices.decode_cached_payload(cache["payload"])["indices"][0]["symbol"] == "SPX"
    assert market_indices.decode_cached_payload(cache["payload"])["indices"][0]["currency"] == "USD"
    assert market_indices.decode_cached_payload(cache["payload"])["indices"][0]["is_fallback_data"] is True
    assert "sparkline_ranges" in market_indices.decode_cached_payload(cache["payload"])["indices"][0]


def test_market_trading_hours_are_timezone_aware() -> None:
    """Trading-hour detection uses each exchange timezone."""
    ny_market = market_indices.INDEX_CONFIGS[0]

    assert market_indices._is_trading(ny_market, datetime(2026, 5, 18, 14, 0, tzinfo=UTC)) is True
    assert market_indices._is_trading(ny_market, datetime(2026, 5, 17, 14, 0, tzinfo=UTC)) is False


def test_market_trading_hours_respect_lunch_breaks() -> None:
    """Lunch breaks are omitted from configured active trading minutes."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")

    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 3, 0, tzinfo=UTC)) is True
    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 4, 0, tzinfo=UTC)) is False
    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 5, 0, tzinfo=UTC)) is True


@pytest.mark.asyncio
async def test_finnhub_index_quote_uses_scaled_proxy_when_index_requires_subscription(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SPX can use Finnhub's SPY quote when direct index data is unavailable."""
    calls: list[str] = []
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")

    async def fake_symbol_quote(symbol: str, _token: str) -> market_indices.IndexQuote | None:
        calls.append(symbol)
        if symbol == spx.finnhub_symbol:
            return None
        return market_indices.IndexQuote(current=550.0, change_pct=2.0, previous_close=540.0)

    monkeypatch.setenv("FINNHUB_KEY", "token")
    monkeypatch.setattr(market_indices, "_fetch_finnhub_symbol_quote", fake_symbol_quote)

    quote = await market_indices._fetch_finnhub_quote(spx)

    assert quote is not None
    assert quote.current == pytest.approx(spx.fallback_value * 1.02)
    assert quote.change_pct == pytest.approx(2.0)
    assert quote.previous_close == pytest.approx(spx.fallback_value)
    assert calls == [spx.finnhub_symbol, spx.finnhub_proxy_symbol]


@pytest.mark.asyncio
async def test_index_quote_uses_fallback_provider_after_configured_providers_miss(monkeypatch: pytest.MonkeyPatch) -> None:
    """Global indices can refresh when Yahoo, Finnhub, and Alpha do not cover the symbol."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")

    async def fake_empty_quote(_config: market_indices.IndexConfig) -> None:
        return None

    async def fake_stooq_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=3200.0, change_pct=1.5, previous_close=3152.71)

    monkeypatch.setattr(market_indices, "_fetch_yahoo_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_finnhub_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_alpha_vantage_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_stooq_quote", fake_stooq_quote)

    quote = await market_indices._fetch_index_quote(sse)

    assert quote is not None
    assert quote.current == pytest.approx(3200.0)
    assert quote.change_pct == pytest.approx(1.5)
    assert quote.previous_close == pytest.approx(3152.71)


def test_market_cache_ttl_shortens_during_trading() -> None:
    """Market-index cache freshness uses a shorter TTL during live sessions."""
    assert market_indices._market_cache_ttl_seconds(datetime(2026, 5, 18, 14, 0, tzinfo=UTC)) == 15
    assert market_indices._market_cache_ttl_seconds(datetime(2026, 5, 18, 22, 30, tzinfo=UTC)) == 120


def test_intraday_fallback_only_generates_elapsed_minutes_during_trading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Generated emergency intraday series does not pre-fill the rest of an active session."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 2, 0, tzinfo=UTC))

    points = market_indices._fallback_intraday_series(sse, 3200.0, 1.0)

    assert points[0].timestamp.isoformat().endswith("09:30:00+08:00")
    assert points[-1].timestamp.isoformat().endswith("10:00:00+08:00")
    assert len(points) == 31
    assert points == market_indices._fallback_intraday_series(sse, 3200.0, 1.0)
    assert len({point.value for point in points}) > 10


@pytest.mark.asyncio
async def test_intraday_fetch_uses_yahoo_before_other_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Yahoo is the primary intraday source because it covers all configured indices."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    calls: list[str] = []
    yahoo_points = [
        market_indices.IntradayPoint(datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ), 3200.0),
        market_indices.IntradayPoint(datetime(2026, 5, 18, 9, 31, tzinfo=market_indices.BEIJING_TZ), 3201.0),
    ]

    async def fake_yahoo(_config: market_indices.IndexConfig) -> list[market_indices.IntradayPoint]:
        calls.append("yahoo")
        return yahoo_points

    async def fake_finnhub(_config: market_indices.IndexConfig, _target_value: float) -> None:
        calls.append("finnhub")
        return None

    async def fake_alpha(_config: market_indices.IndexConfig) -> None:
        calls.append("alpha")
        return None

    monkeypatch.setattr(market_indices, "_fetch_yahoo_intraday_series", fake_yahoo)
    monkeypatch.setattr(market_indices, "_fetch_finnhub_intraday_series", fake_finnhub)
    monkeypatch.setattr(market_indices, "_fetch_alpha_vantage_intraday_series", fake_alpha)
    monkeypatch.setattr(market_indices, "_is_trading", lambda _config: True)

    result = await market_indices._fetch_intraday_series(sse, 3200.0)

    assert result == yahoo_points
    assert calls == ["yahoo"]


@pytest.mark.asyncio
async def test_intraday_fetch_skips_providers_when_market_is_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Closed markets do not call intraday providers during refresh cycles."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    calls: list[str] = []

    async def fake_yahoo(_config: market_indices.IndexConfig) -> None:
        calls.append("yahoo")
        return None

    monkeypatch.setattr(market_indices, "_is_trading", lambda _config: False)
    monkeypatch.setattr(market_indices, "_fetch_yahoo_intraday_series", fake_yahoo)

    result = await market_indices._fetch_intraday_series(sse, 3200.0)

    assert result is None
    assert calls == []


@pytest.mark.asyncio
async def test_yahoo_quote_uses_browser_headers_and_query2_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    """Yahoo chart requests send browser headers and retry query2 after query1 failures."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[tuple[dict[str, str], str]] = []

    class FakeAsyncClient:
        def __init__(self, *, headers: dict[str, str], timeout: int, limits: httpx.Limits) -> None:
            self.headers = headers
            self.timeout = timeout
            self.limits = limits
            self.is_closed = False

        async def get(self, url: str, params: dict[str, str]) -> httpx.Response:
            calls.append((self.headers, url))
            request = httpx.Request("GET", url, params=params)
            if "query1.finance.yahoo.com" in url:
                return httpx.Response(403, request=request, text="Forbidden")
            return httpx.Response(
                200,
                request=request,
                json={
                    "chart": {
                        "result": [
                            {
                                "meta": {
                                    "chartPreviousClose": 5900.0,
                                    "regularMarketPrice": 6000.0,
                                }
                            }
                        ],
                        "error": None,
                    }
                },
            )

    monkeypatch.setattr(market_indices.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(market_indices, "_yahoo_client", None)

    quote = await market_indices._fetch_yahoo_quote(spx)

    assert quote is not None
    assert quote.current == pytest.approx(6000.0)
    assert quote.previous_close == pytest.approx(5900.0)
    assert [url.split("/")[2] for _, url in calls] == ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]
    assert all("Chrome/131.0.0.0" in headers["User-Agent"] for headers, _ in calls)


@pytest.mark.asyncio
async def test_refresh_market_indices_throttles_between_index_builds(monkeypatch: pytest.MonkeyPatch) -> None:
    """Refresh cycles space index builds so Yahoo requests are not sent in a burst."""
    configs = market_indices.INDEX_CONFIGS[:3]
    sleeps: list[float] = []

    async def fake_cache_get() -> None:
        return None

    async def fake_cache_set(_value: str) -> None:
        return None

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)

    async def fake_build_index(config: market_indices.IndexConfig) -> market_indices.MarketIndex:
        return market_indices.MarketIndex(
            symbol=config.symbol,
            name=config.name,
            value=100.0,
            previous_close=99.0,
            change_pct=1.0,
            market=config.market,
            currency=config.currency,
            is_trading=False,
            is_fallback_data=False,
            trading_hours=market_indices.TradingHours(
                open=config.open_time.strftime("%H:%M"),
                close=config.close_time.strftime("%H:%M"),
                timezone=config.timezone,
                sessions=[
                    market_indices.TradingSession(
                        open=session_open.strftime("%H:%M"),
                        close=session_close.strftime("%H:%M"),
                    )
                    for session_open, session_close in config.sessions
                ],
            ),
        )

    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", configs)
    monkeypatch.setattr(market_indices, "_cache_get", fake_cache_get)
    monkeypatch.setattr(market_indices, "_cache_set", fake_cache_set)
    monkeypatch.setattr(market_indices, "_build_index", fake_build_index)
    monkeypatch.setattr(market_indices.asyncio, "sleep", fake_sleep)

    response = await market_indices.refresh_market_indices(force=True)

    assert [index.symbol for index in response.indices] == [config.symbol for config in configs]
    assert sleeps == [
        market_indices.MARKET_INDEX_REFRESH_DELAY_SECONDS,
        market_indices.MARKET_INDEX_REFRESH_DELAY_SECONDS,
    ]


@pytest.mark.asyncio
async def test_historical_cache_round_trips_daily_points(monkeypatch: pytest.MonkeyPatch) -> None:
    """Historical daily candles are serialized into a long-lived Redis cache."""
    stored: dict[str, str] = {}

    class FakeRedis:
        async def get(self, key: str) -> str | None:
            return stored.get(key)

        async def set(self, key: str, value: str, ex: int) -> None:
            stored[key] = value
            stored[f"{key}:ttl"] = str(ex)

        async def aclose(self) -> None:
            return None

    monkeypatch.setattr(market_indices, "create_redis_client", FakeRedis)
    points = [
        market_indices.IntradayPoint(datetime(2026, 5, 18, 16, 0, tzinfo=market_indices.BEIJING_TZ), 6000.0),
        market_indices.IntradayPoint(datetime(2026, 5, 19, 16, 0, tzinfo=market_indices.BEIJING_TZ), 6010.5),
    ]

    await market_indices._set_cached_historical("SPX", points)
    cached = await market_indices._get_cached_historical("SPX")

    assert cached == points
    assert stored["sigma:historical:SPX:ttl"] == str(market_indices.HISTORICAL_CACHE_TTL_SECONDS)


@pytest.mark.asyncio
async def test_cached_historical_ranges_fallback_without_yahoo_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    """Historical ranges only read Redis and fall back without fetching Yahoo."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_get_cached(_symbol: str) -> None:
        return None

    async def fake_yahoo(_config: market_indices.IndexConfig, provider_range: str) -> list[market_indices.IntradayPoint]:
        calls.append(provider_range)
        return []

    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 22, 30, tzinfo=UTC))
    monkeypatch.setattr(market_indices, "_get_cached_historical", fake_get_cached)
    monkeypatch.setattr(market_indices, "_fetch_yahoo_historical_series", fake_yahoo)

    ranges = await market_indices._read_cached_historical_ranges(spx, 6000.0, 1.0)

    assert calls == []
    assert len(ranges["5D"].values) == 5


@pytest.mark.asyncio
async def test_historical_job_incrementally_appends_new_completed_days(monkeypatch: pytest.MonkeyPatch) -> None:
    """The independent historical job updates stale caches with recent completed candles."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    cached_points = [
        market_indices.IntradayPoint(datetime(2026, 5, 15, 4, 0, tzinfo=market_indices.BEIJING_TZ), 5800.0),
        market_indices.IntradayPoint(datetime(2026, 5, 16, 4, 0, tzinfo=market_indices.BEIJING_TZ), 5900.0),
    ]
    recent_points = [
        market_indices.IntradayPoint(datetime(2026, 5, 16, 4, 0, tzinfo=market_indices.BEIJING_TZ), 5900.0),
        market_indices.IntradayPoint(datetime(2026, 5, 19, 4, 0, tzinfo=market_indices.BEIJING_TZ), 6000.0),
    ]
    calls: list[str] = []
    stored: list[market_indices.IntradayPoint] = []

    async def fake_get_cached(_symbol: str) -> list[market_indices.IntradayPoint]:
        return cached_points

    async def fake_set_cached(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        stored.extend(points)

    async def fake_yahoo(_config: market_indices.IndexConfig, provider_range: str) -> list[market_indices.IntradayPoint]:
        calls.append(provider_range)
        return recent_points

    async def fake_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 22, 30, tzinfo=UTC))
    monkeypatch.setattr(market_indices, "_get_cached_historical", fake_get_cached)
    monkeypatch.setattr(market_indices, "_set_cached_historical", fake_set_cached)
    monkeypatch.setattr(market_indices, "_fetch_yahoo_historical_series", fake_yahoo)
    monkeypatch.setattr(market_indices.asyncio, "sleep", fake_sleep)

    await market_indices.refresh_historical_data_job()

    assert calls == ["5d"]
    assert [point.value for point in stored] == [5800.0, 5900.0, 6000.0]


@pytest.mark.asyncio
async def test_historical_job_rate_limits_trading_fetches(monkeypatch: pytest.MonkeyPatch) -> None:
    """Trading markets have independent 30-second historical fetch timers."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    cached_points = [
        market_indices.IntradayPoint(datetime(2026, 5, 14, 4, 0, tzinfo=market_indices.BEIJING_TZ), 5800.0),
    ]
    calls: list[str] = []

    async def fake_get_cached(_symbol: str) -> list[market_indices.IntradayPoint]:
        return cached_points

    async def fake_yahoo(_config: market_indices.IndexConfig, provider_range: str) -> None:
        calls.append(provider_range)
        return None

    market_indices._historical_last_fetch.clear()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC))
    monkeypatch.setattr(market_indices, "_get_cached_historical", fake_get_cached)
    monkeypatch.setattr(market_indices, "_fetch_yahoo_historical_series", fake_yahoo)

    await market_indices.refresh_historical_data_job()
    await market_indices.refresh_historical_data_job()

    assert calls == ["5d"]
    market_indices._historical_last_fetch.clear()


def test_historical_point_dates_use_exchange_timezone() -> None:
    """Historical cache freshness compares sessions in each index exchange timezone."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    point = market_indices.IntradayPoint(datetime(2026, 5, 19, 4, 0, tzinfo=market_indices.BEIJING_TZ), 6000.0)

    assert point.timestamp.date().isoformat() == "2026-05-19"
    assert market_indices._historical_point_date(spx, point).isoformat() == "2026-05-18"


def test_historical_cache_trim_keeps_recent_one_year_buffer() -> None:
    """Historical cache is capped so one-year chart data does not grow forever."""
    points = [
        market_indices.IntradayPoint(
            datetime(2025, 1, 1, 16, 0, tzinfo=market_indices.BEIJING_TZ) + timedelta(days=offset),
            5000.0 + offset,
        )
        for offset in range(270)
    ]

    trimmed = market_indices._trim_historical_points(points)

    assert len(trimmed) == market_indices.MAX_HISTORICAL_POINTS
    assert trimmed[0] == points[18]
    assert trimmed[-1] == points[-1]


def test_intraday_alignment_filters_lunch_break_points() -> None:
    """Provider candles inside declared market breaks are discarded before alignment."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")

    aligned = market_indices._align_intraday_points(
        sse,
        datetime(2026, 5, 18, tzinfo=market_indices.BEIJING_TZ).date(),
        [
            market_indices.IntradayPoint(datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ), 3200.0),
            market_indices.IntradayPoint(datetime(2026, 5, 18, 12, 0, tzinfo=market_indices.BEIJING_TZ), 9999.0),
            market_indices.IntradayPoint(datetime(2026, 5, 18, 13, 0, tzinfo=market_indices.BEIJING_TZ), 3210.0),
        ],
    )

    assert aligned is not None
    assert all(not point.timestamp.isoformat().endswith("12:00:00+08:00") for point in aligned)
    assert all(point.value != 9999.0 for point in aligned)


def test_intraday_alignment_warns_when_forward_fill_ratio_is_high(caplog: pytest.LogCaptureFixture) -> None:
    """Sparse provider candles are logged when alignment mostly forward-fills prices."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    aligned = market_indices._align_intraday_points(
        spx,
        datetime(2026, 5, 18, tzinfo=market_indices.BEIJING_TZ).date(),
        [
            market_indices.IntradayPoint(datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 5990.0),
            market_indices.IntradayPoint(datetime(2026, 5, 18, 22, 0, tzinfo=market_indices.BEIJING_TZ), 6000.0),
        ],
    )

    assert aligned is not None
    assert len(aligned) == 31
    assert "SPX intraday alignment forward-filled 93.5% of 31 chart points" in caplog.text


@pytest.mark.asyncio
async def test_sparse_intraday_series_logs_warning(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    """Sparse intraday provider data is visible in logs before charts flatten out."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")

    async def fake_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=6000.0, change_pct=1.0, previous_close=5940.0)

    async def fake_intraday(_config: market_indices.IndexConfig, _value: float) -> list[market_indices.IntradayPoint]:
        return [
            market_indices.IntradayPoint(datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 5990.0),
            market_indices.IntradayPoint(datetime(2026, 5, 18, 21, 31, tzinfo=market_indices.BEIJING_TZ), 6000.0),
        ]

    async def fake_historical(
        _config: market_indices.IndexConfig,
        _value: float,
        _change_pct: float,
    ) -> dict[str, market_indices.MarketSparkline]:
        return {}

    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)
    monkeypatch.setattr(market_indices, "_fetch_intraday_series", fake_intraday)
    monkeypatch.setattr(market_indices, "_read_cached_historical_ranges", fake_historical)
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    index = await market_indices._build_index(spx)

    assert len(index.sparkline_24h) == 2
    assert index.is_fallback_data is False
    assert "SPX returned only 2 intraday chart points" in caplog.text


def test_historical_fallback_generates_weekday_daily_points(monkeypatch: pytest.MonkeyPatch) -> None:
    """Generated range fallbacks provide date-spanning data for multi-day chart ticks."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 22, 30, tzinfo=UTC))

    points = market_indices._fallback_historical_series(spx, 6000.0, 2.0, 5)

    assert len(points) == 5
    assert points[0].timestamp.date() < points[-1].timestamp.date()
    assert all(point.value > 0 for point in points)


@pytest.mark.asyncio
async def test_refresh_job_skips_when_all_markets_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Scheduler job avoids API refresh work when every market is closed."""
    called = False

    async def fake_refresh(*_args: object, **_kwargs: object) -> None:
        nonlocal called
        called = True

    monkeypatch.setattr("app.scheduler.jobs.any_market_trading_now", lambda: False)
    monkeypatch.setattr("app.scheduler.jobs.refresh_market_indices", fake_refresh)

    await refresh_market_indices_job()

    assert called is False


def test_scheduler_registers_market_indices_job() -> None:
    """Scheduler registers a near-real-time refresh job for the ticker strip cache."""
    scheduler.remove_all_jobs()

    add_market_indices_job()

    job = scheduler.get_job("market-indices:refresh")
    assert job is not None
    assert str(job.trigger) == "interval[0:00:15]"
    historical_job = scheduler.get_job("market-indices:historical")
    assert historical_job is not None
    assert str(historical_job.trigger) == "interval[0:00:10]"
    scheduler.remove_all_jobs()
