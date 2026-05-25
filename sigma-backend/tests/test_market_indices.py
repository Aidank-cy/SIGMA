from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.api.v1.routes import market_indices as market_indices_routes
from app.api.v1.routes.market_indices import list_market_indices
from app.scheduler.engine import add_market_indices_job, scheduler
from app.scheduler.jobs import refresh_market_indices_job
from app.schemas.market import MarketIndex, MarketIndicesResponse, TradingHours, TradingSession
from app.services import market_candles
from app.services import market_indices


def test_market_indices_http_response_shape(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Market-indices endpoint returns timestamped index quotes with sparkline data."""

    async def fake_market_indices() -> MarketIndicesResponse:
        return MarketIndicesResponse(
            updated_at=datetime(2026, 5, 22, 12, 0, tzinfo=UTC),
            indices=[
                MarketIndex(
                    symbol="SPX",
                    name="S&P 500",
                    value=5842.15,
                    previous_close=5818.3,
                    change_pct=0.41,
                    market="us",
                    currency="USD",
                    is_trading=True,
                    trading_hours=TradingHours(
                        open="09:30",
                        close="16:00",
                        timezone="America/New_York",
                        sessions=[TradingSession(open="09:30", close="16:00")],
                        beijing_sessions=[TradingSession(open="21:30", close="04:00")],
                    ),
                    sparkline_24h=[5830.0, 5842.15],
                    sparkline_times=["2026-05-22T21:30:00+08:00", "2026-05-22T21:31:00+08:00"],
                    sparkline_ranges={},
                )
            ],
        )

    monkeypatch.setattr(market_indices_routes, "get_market_indices", fake_market_indices)

    response = client.get("/api/v1/market-indices")

    assert response.status_code == 200
    payload = response.json()
    assert payload["updated_at"] == "2026-05-22T12:00:00Z"
    assert len(payload["indices"]) == 1
    index = payload["indices"][0]
    assert {
        "symbol",
        "name",
        "value",
        "change_pct",
        "market",
        "is_trading",
    }.issubset(index)
    assert index["symbol"] == "SPX"
    assert index["name"] == "S&P 500"
    assert index["value"] == 5842.15
    assert index["change_pct"] == 0.41
    assert index["market"] == "us"
    assert index["is_trading"] is True
    assert index["sparkline_24h"] == [5830.0, 5842.15]
    assert all(isinstance(point, int | float) for point in index["sparkline_24h"])


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

    async def fake_intraday(_config: market_indices.IndexConfig) -> None:
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
            for range_key in ("5D", "1M", "3M", "1Y")
        }

    async def fake_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(market_indices, "_cache_get", fake_cache_get)
    monkeypatch.setattr(market_indices, "_cache_set", fake_cache_set)
    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)
    monkeypatch.setattr(market_indices, "_read_intraday_from_redis", fake_intraday)
    monkeypatch.setattr(market_indices, "_read_candle_ranges", fake_historical)
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
    """Global indices can refresh when Finnhub and Alpha do not cover the symbol."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")

    async def fake_empty_quote(_config: market_indices.IndexConfig) -> None:
        return None

    async def fake_stooq_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=3200.0, change_pct=1.5, previous_close=3152.71)

    monkeypatch.setattr(market_indices, "_fetch_finnhub_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_alpha_vantage_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_stooq_quote", fake_stooq_quote)

    quote = await market_indices._fetch_index_quote(sse)

    assert quote is not None
    assert quote.current == pytest.approx(3200.0)
    assert quote.change_pct == pytest.approx(1.5)
    assert quote.previous_close == pytest.approx(3152.71)


def test_dax_skips_alpha_vantage_etf_symbol() -> None:
    """DAX avoids Alpha Vantage's ETF symbol trap and falls through to Stooq."""
    dax = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "DAX")

    assert dax.alpha_symbol == ""
    assert dax.stooq_symbol == "^dax"


@pytest.mark.asyncio
async def test_build_index_discards_suspiciously_small_quote(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Quotes far below the configured index baseline are ignored before rendering."""
    dax = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "DAX")

    async def fake_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=30.0, change_pct=0.5, previous_close=29.85)

    async def fake_intraday(_config: market_indices.IndexConfig) -> None:
        return None

    async def fake_historical(
        _config: market_indices.IndexConfig,
        _value: float,
        _change_pct: float,
    ) -> dict[str, market_indices.MarketSparkline]:
        return {}

    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)
    monkeypatch.setattr(market_indices, "_read_intraday_from_redis", fake_intraday)
    monkeypatch.setattr(market_indices, "_read_candle_ranges", fake_historical)
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    index = await market_indices._build_index(dax)

    assert index.value == pytest.approx(dax.fallback_value)
    assert index.change_pct == pytest.approx(dax.fallback_change_pct)
    assert "Discarding suspicious quote for DAX: got 30.00" in caplog.text


def test_market_cache_ttl_shortens_during_trading() -> None:
    """Market-index cache freshness uses a shorter TTL during live sessions."""
    assert market_indices._market_cache_ttl_seconds(datetime(2026, 5, 18, 14, 0, tzinfo=UTC)) == 15
    assert market_indices._market_cache_ttl_seconds(datetime(2026, 5, 18, 22, 30, tzinfo=UTC)) == 120
    assert market_indices._market_cache_expiration_seconds(datetime(2026, 5, 18, 14, 0, tzinfo=UTC)) == 300
    assert market_indices._market_cache_expiration_seconds(datetime(2026, 5, 18, 22, 30, tzinfo=UTC)) == 300


@pytest.mark.asyncio
async def test_get_market_indices_returns_stale_cache_without_blocking_refresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A stale cache is returned immediately instead of blocking behind provider refreshes."""
    cached = MarketIndicesResponse(
        updated_at=datetime(2026, 5, 18, 12, 0, tzinfo=UTC),
        indices=[
            MarketIndex(
                symbol="SPX",
                name="S&P 500",
                value=5842.15,
                previous_close=5818.3,
                change_pct=0.41,
                market="us",
                currency="USD",
                is_trading=True,
                trading_hours=TradingHours(
                    open="09:30",
                    close="16:00",
                    timezone="America/New_York",
                    sessions=[TradingSession(open="09:30", close="16:00")],
                    beijing_sessions=[TradingSession(open="21:30", close="04:00")],
                ),
                sparkline_24h=[5830.0, 5842.15],
                sparkline_times=["2026-05-18T21:30:00+08:00", "2026-05-18T21:31:00+08:00"],
                sparkline_ranges={},
            )
        ],
    )

    async def fake_cache_get() -> str:
        return cached.model_dump_json()

    async def fail_refresh(*_args: object, **_kwargs: object) -> MarketIndicesResponse:
        raise AssertionError("stale cache should avoid synchronous provider refresh")

    monkeypatch.setattr(market_indices, "_cache_get", fake_cache_get)
    monkeypatch.setattr(market_indices, "refresh_market_indices", fail_refresh)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC))

    response = await market_indices.get_market_indices()

    assert response.indices[0].symbol == "SPX"
    assert response.updated_at == cached.updated_at


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
async def test_read_intraday_from_redis_requires_enough_points(monkeypatch: pytest.MonkeyPatch) -> None:
    """Market-index refresh reads intraday points from Redis instead of providers."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 2, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(10)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_indices._read_intraday_from_redis(sse) == redis_points


@pytest.mark.asyncio
async def test_read_intraday_from_redis_filters_previous_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """Redis candles from a previous trading day are not served as today's intraday chart."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 2, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 15, 9, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(20)
    ]
    redis_points.extend(
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(minutes=offset),
            3300.0 + offset,
        )
        for offset in range(9)
    )

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_indices._read_intraday_from_redis(sse) is None


@pytest.mark.asyncio
async def test_read_intraday_from_redis_keeps_last_session_when_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Closed markets can still serve the latest full Redis session."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 17, 4, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 15, 9, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(20)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_indices._read_intraday_from_redis(sse) == redis_points


@pytest.mark.asyncio
async def test_read_intraday_from_redis_clears_weekday_pre_open(monkeypatch: pytest.MonkeyPatch) -> None:
    """Weekday pre-open Redis data waits for fresh candles instead of serving the old session."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 0, 30, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 15, 9, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(20)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_indices._read_intraday_from_redis(sse) is None


@pytest.mark.asyncio
async def test_quote_falls_back_to_redis_candle(monkeypatch: pytest.MonkeyPatch) -> None:
    """Market-index refresh can derive a last-resort quote from Redis candles."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    redis_points = [
        market_indices.IntradayPoint(datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ), 3000.0),
        market_indices.IntradayPoint(datetime(2026, 5, 18, 9, 31, tzinfo=market_indices.BEIJING_TZ), 3030.0),
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    quote = await market_indices._quote_from_redis_candle(sse)

    assert quote is not None
    assert quote.current == pytest.approx(3030.0)
    assert quote.change_pct == pytest.approx(1.0)
    assert quote.previous_close == pytest.approx(3000.0)


@pytest.mark.asyncio
async def test_build_index_is_yahoo_free(monkeypatch: pytest.MonkeyPatch) -> None:
    """The 15-second market-index refresh builds from Redis/PG without Yahoo calls."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 2, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(minutes=offset),
            3000.0 + offset,
        )
        for offset in range(10)
    ]

    async def fake_quote(_config: market_indices.IndexConfig) -> None:
        return None

    async def fail_yahoo(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("market-index refresh must not call Yahoo")

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    async def fake_historical(
        _config: market_indices.IndexConfig,
        value: float,
        _change_pct: float,
    ) -> dict[str, market_indices.MarketSparkline]:
        return {
            "5D": market_indices.MarketSparkline(
                values=[value],
                times=[redis_points[-1].timestamp.isoformat()],
            )
        }

    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)
    monkeypatch.setattr(market_indices, "_fetch_yahoo_chart_result", fail_yahoo)
    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)
    monkeypatch.setattr(market_indices, "_read_candle_ranges", fake_historical)

    index = await market_indices._build_index(sse)

    assert index.value == pytest.approx(3009.0)
    assert index.change_pct == pytest.approx(0.3)
    assert index.is_fallback_data is False
    assert len(index.sparkline_24h) == 10


@pytest.mark.asyncio
async def test_yahoo_chart_result_uses_user_agent_and_query2_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    """Yahoo chart requests use the configured User-Agent and retry query2 after query1 failures."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_to_thread(
        _func: object,
        url: str,
        _purpose: str,
        _symbol: str,
        host: str,
    ) -> dict[str, object] | None:
        calls.append(url)
        if host == "query1.finance.yahoo.com":
            return None
        return {"meta": {"chartPreviousClose": 5900.0, "regularMarketPrice": 6000.0}}

    monkeypatch.setattr(market_indices.asyncio, "to_thread", fake_to_thread)
    monkeypatch.setattr(market_indices, "_yahoo_last_request_time", 0.0)
    monkeypatch.setattr(market_indices, "_yahoo_backoff_until", 0.0)
    monkeypatch.setattr(market_indices, "_yahoo_consecutive_429s", 0)

    result = await market_indices._fetch_yahoo_chart_result(spx, params={}, purpose="test")

    assert isinstance(result, dict)
    assert result["meta"]["regularMarketPrice"] == pytest.approx(6000.0)
    assert [url.split("/")[2] for url in calls] == ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]
    assert market_indices.YAHOO_HEADERS["User-Agent"] == "Mozilla/5.0"


@pytest.mark.asyncio
async def test_yahoo_chart_result_backs_off_on_429(monkeypatch: pytest.MonkeyPatch) -> None:
    """Yahoo 429 responses activate global backoff and skip host retry."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_to_thread(
        _func: object,
        url: str,
        _purpose: str,
        _symbol: str,
        _host: str,
    ) -> str:
        calls.append(url)
        return "_429"

    monkeypatch.setattr(market_indices.asyncio, "to_thread", fake_to_thread)
    monkeypatch.setattr(market_indices, "_yahoo_last_request_time", 0.0)
    monkeypatch.setattr(market_indices, "_yahoo_backoff_until", 0.0)
    monkeypatch.setattr(market_indices, "_yahoo_consecutive_429s", 0)

    result = await market_indices._fetch_yahoo_chart_result(spx, params={}, purpose="test")

    assert result is None
    assert len(calls) == 1
    assert market_indices._yahoo_consecutive_429s == 1
    assert market_indices._yahoo_backoff_until > 0


@pytest.mark.asyncio
async def test_refresh_market_indices_throttles_between_index_builds(monkeypatch: pytest.MonkeyPatch) -> None:
    """Refresh cycles still space index builds to avoid provider bursts."""
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
async def test_candle_cache_round_trips_redis_points(monkeypatch: pytest.MonkeyPatch) -> None:
    """One-minute candle points round-trip through the new Redis keys."""
    stored: dict[str, str] = {}

    class FakeRedis:
        async def get(self, key: str) -> str | None:
            return stored.get(key)

        async def set(self, key: str, value: str, ex: int) -> None:
            stored[key] = value
            stored[f"{key}:ttl"] = str(ex)

        async def aclose(self) -> None:
            return None

    monkeypatch.setattr(market_candles, "create_redis_client", FakeRedis)
    points = [
        market_indices.IntradayPoint(datetime(2026, 5, 18, 16, 0, tzinfo=market_indices.BEIJING_TZ), 6000.0),
        market_indices.IntradayPoint(datetime(2026, 5, 19, 16, 0, tzinfo=market_indices.BEIJING_TZ), 6010.5),
    ]

    await market_candles._redis_set_5d("SPX", points)
    cached = await market_candles._redis_get_5d("SPX")

    assert cached == points
    assert stored["sigma:candles:5d:SPX:ttl"] == str(market_candles.CANDLE_5D_TTL)


@pytest.mark.asyncio
async def test_candle_ranges_read_storage_and_fallback_without_yahoo_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    """Historical ranges only read candle storage and fall back without fetching Yahoo."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    redis_points = [
        market_indices.IntradayPoint(datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 5990.0),
        market_indices.IntradayPoint(datetime(2026, 5, 18, 21, 31, tzinfo=market_indices.BEIJING_TZ), 6000.0),
    ]

    async def fake_redis_get_5d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    pg_calls: list[tuple[str, int]] = []

    async def fake_pg_get(_symbol: str, interval: str, limit: int) -> list[market_indices.IntradayPoint]:
        assert limit > 0
        pg_calls.append((interval, limit))
        return []

    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 22, 30, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_redis_get_5d", fake_redis_get_5d)
    monkeypatch.setattr(market_candles, "_pg_get_candles", fake_pg_get)

    ranges = await market_indices._read_candle_ranges(spx, 6000.0, 1.0)

    assert ranges["5D"].values == [5990.0, 6000.0]
    assert len(ranges["1M"].values) == 22
    assert pg_calls == [("15m", 600), ("60m", 500), ("60m", 1800)]


@pytest.mark.asyncio
async def test_candle_job_runs_cold_start_piece_when_history_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """The independent candle job fetches one Redis 1D cold-start piece during trading."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_redis_has_1d(_symbol: str) -> bool:
        return False

    async def fake_yahoo(_config: market_indices.IndexConfig, interval: str, range_: str) -> list[market_indices.IntradayPoint]:
        calls.append(f"{interval}:{range_}")
        return [market_indices.IntradayPoint(datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 6000.0)]

    async def fake_set_1d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set1d:{len(points)}")

    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_redis_has_1d", fake_redis_has_1d)
    monkeypatch.setattr(market_candles, "_yahoo_fetch", fake_yahoo)
    monkeypatch.setattr(market_candles, "_redis_set_1d", fake_set_1d)

    await market_candles.candle_refresh_job()

    assert calls == ["1m:1d", "set1d:1"]


@pytest.mark.asyncio
async def test_cold_start_pieces_fill_redis_before_postgres_intervals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cold start fills Redis 1D/5D before PostgreSQL 15m/60m intervals."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []
    point = market_indices.IntradayPoint(datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 6000.0)
    state = {"has_1d": False, "has_5d": False, "has_15m": False, "has_60m": False}

    async def fake_yahoo(_config: market_indices.IndexConfig, interval: str, range_: str) -> list[market_indices.IntradayPoint]:
        calls.append(f"{interval}:{range_}")
        return [point]

    async def fake_upsert(_symbol: str, interval: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"upsert:{interval}:{len(points)}")

    async def fake_set_5d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set5d:{len(points)}")

    async def fake_set_1d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set1d:{len(points)}")
        state["has_1d"] = True

    async def fake_has_1d(_symbol: str) -> bool:
        return state["has_1d"]

    async def fake_has_5d(_symbol: str) -> bool:
        return state["has_5d"]

    async def fake_has_interval(_symbol: str, interval: str) -> bool:
        return bool(state[f"has_{interval}"])

    async def fake_set_5d_with_state(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        await fake_set_5d(_symbol, points)
        state["has_5d"] = True

    async def fake_upsert_with_state(
        _symbol: str,
        interval: str,
        points: list[market_indices.IntradayPoint],
    ) -> None:
        await fake_upsert(_symbol, interval, points)
        state[f"has_{interval}"] = True

    monkeypatch.setattr(market_candles, "_yahoo_fetch", fake_yahoo)
    monkeypatch.setattr(market_candles, "_pg_upsert_candles", fake_upsert_with_state)
    monkeypatch.setattr(market_candles, "_redis_set_5d", fake_set_5d_with_state)
    monkeypatch.setattr(market_candles, "_redis_set_1d", fake_set_1d)
    monkeypatch.setattr(market_candles, "_redis_has_1d", fake_has_1d)
    monkeypatch.setattr(market_candles, "_redis_has_5d", fake_has_5d)
    monkeypatch.setattr(market_candles, "_pg_has_interval", fake_has_interval)
    monkeypatch.setattr(market_candles, "_filter_today", lambda _config, points: points)

    for _ in range(5):
        await market_candles._cold_start_next_piece(spx)

    assert calls == [
        "1m:1d",
        "set1d:1",
        "1m:5d",
        "set5d:1",
        "set1d:1",
        "15m:1mo",
        "upsert:15m:1",
        "60m:1y",
        "upsert:60m:1",
    ]
    assert market_candles._cold_start_done[spx.symbol] is True


@pytest.mark.asyncio
async def test_end_of_day_downsamples_to_fifteen_and_sixty_minute_intervals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-of-day storage writes only the upgraded PostgreSQL candle intervals."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(minutes=offset),
            6000.0 + offset,
        )
        for offset in range(60)
    ]
    calls: list[str] = []

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return points

    async def fake_has_date(_symbol: str, interval: str, _target_date: object) -> bool:
        calls.append(f"has:{interval}")
        return False

    async def fake_upsert(_symbol: str, interval: str, stored: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"upsert:{interval}:{len(stored)}")

    async def fake_get_5d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return []

    async def fake_set_5d(_symbol: str, stored: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set5d:{len(stored)}")

    async def fake_delete(_symbol: str) -> None:
        calls.append("delete-old")

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)
    monkeypatch.setattr(market_candles, "_pg_has_date", fake_has_date)
    monkeypatch.setattr(market_candles, "_pg_upsert_candles", fake_upsert)
    monkeypatch.setattr(market_candles, "_redis_get_5d", fake_get_5d)
    monkeypatch.setattr(market_candles, "_redis_set_5d", fake_set_5d)
    monkeypatch.setattr(market_candles, "_pg_delete_older_than_1y", fake_delete)

    await market_candles._end_of_day_downsample_if_needed(spx)

    assert calls == ["has:60m", "upsert:15m:4", "upsert:60m:2", "set5d:60", "delete-old"]


@pytest.mark.asyncio
async def test_candle_job_rate_limits_trading_fetches(monkeypatch: pytest.MonkeyPatch) -> None:
    """Trading markets have independent 30-second 1-minute fetch timers."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_has_full_year(_symbol: str) -> bool:
        return True

    async def fake_fetch_1d(_config: market_indices.IndexConfig) -> None:
        calls.append("fetch")

    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._cold_start_done[spx.symbol] = True
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_pg_has_full_year", fake_has_full_year)
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch_1d)

    await market_candles.candle_refresh_job()
    await market_candles.candle_refresh_job()

    assert calls == ["fetch"]
    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()


def test_trim_to_trading_days_uses_exchange_timezone() -> None:
    """The rolling 5D cache groups cross-midnight Beijing points by exchange date."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 11, 21, 30, tzinfo=market_indices.BEIJING_TZ) + timedelta(days=offset),
            5000.0 + offset,
        )
        for offset in range(7)
    ]

    trimmed = market_candles._trim_to_n_trading_days(spx, points, n=5)

    assert len(trimmed) == 5
    assert trimmed[0] == points[2]
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

    async def fake_intraday(_config: market_indices.IndexConfig) -> list[market_indices.IntradayPoint]:
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
    monkeypatch.setattr(market_indices, "_read_intraday_from_redis", fake_intraday)
    monkeypatch.setattr(market_indices, "_read_candle_ranges", fake_historical)
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    index = await market_indices._build_index(spx)

    assert len(index.sparkline_24h) == 2
    assert index.is_fallback_data is False
    assert "SPX has only 2 intraday chart points" in caplog.text


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


@pytest.mark.asyncio
async def test_refresh_job_respects_fresh_market_index_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """Scheduler refreshes use normal cache freshness checks instead of forced overwrites."""
    calls: list[bool] = []

    async def fake_refresh(*_args: object, force: bool = False, **_kwargs: object) -> None:
        calls.append(force)

    monkeypatch.setattr("app.scheduler.jobs.any_market_trading_now", lambda: True)
    monkeypatch.setattr("app.scheduler.jobs.refresh_market_indices", fake_refresh)

    await refresh_market_indices_job()

    assert calls == [False]


def test_scheduler_registers_market_indices_job() -> None:
    """Scheduler registers a near-real-time refresh job for the ticker strip cache."""
    scheduler.remove_all_jobs()

    add_market_indices_job()

    job = scheduler.get_job("market-indices:refresh")
    assert job is not None
    assert str(job.trigger) == "interval[0:00:15]"
    candle_job = scheduler.get_job("market-candles:refresh")
    assert candle_job is not None
    assert str(candle_job.trigger) == "interval[0:00:10]"
    scheduler.remove_all_jobs()
