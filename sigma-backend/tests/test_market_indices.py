import asyncio
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.api.v1.routes import market_indices as market_indices_routes
from app.api.v1.routes.market_indices import list_market_indices
from app.scheduler.engine import add_market_indices_job, scheduler
from app.scheduler.jobs import refresh_market_indices_job
from app.schemas.market import MarketIndex, MarketIndicesResponse, TradingHours, TradingSession
from app.services import market_candles, market_indices


@pytest.fixture(autouse=True)
def skip_pg_integrity_check(monkeypatch: pytest.MonkeyPatch) -> None:
    """Most scheduler tests focus on candle flow, not startup database cleanup."""
    monkeypatch.setattr(market_candles, "_pg_integrity_checked", True)
    market_indices._yahoo_meta_cache.clear()


def test_market_indices_http_response_shape(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
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
async def test_market_indices_endpoint_returns_supported_indices(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 22, 30, tzinfo=UTC)
    )

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
    assert all(length == 0 for length in lengths.values())
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
    assert market_indices.decode_cached_payload(cache["payload"])["indices"][0]["symbol"] == "SPX"
    assert market_indices.decode_cached_payload(cache["payload"])["indices"][0]["currency"] == "USD"
    assert (
        market_indices.decode_cached_payload(cache["payload"])["indices"][0]["is_fallback_data"]
        is True
    )
    assert (
        "sparkline_ranges" in market_indices.decode_cached_payload(cache["payload"])["indices"][0]
    )


def test_market_trading_hours_are_timezone_aware() -> None:
    """Trading-hour detection uses each exchange timezone."""
    ny_market = market_indices.INDEX_CONFIGS[0]

    assert market_indices._is_trading(ny_market, datetime(2026, 5, 18, 14, 0, tzinfo=UTC)) is True
    assert market_indices._is_trading(ny_market, datetime(2026, 5, 17, 14, 0, tzinfo=UTC)) is False


def test_market_trading_hours_respect_lunch_breaks() -> None:
    """Lunch breaks are omitted from configured active trading minutes."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")

    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 3, 0, tzinfo=UTC)) is True
    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 3, 30, tzinfo=UTC)) is True
    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 4, 0, tzinfo=UTC)) is False
    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 5, 0, tzinfo=UTC)) is True
    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 7, 0, tzinfo=UTC)) is True
    assert market_indices._is_trading(sse, datetime(2026, 5, 18, 7, 1, tzinfo=UTC)) is False


@pytest.mark.asyncio
async def test_finnhub_index_quote_does_not_use_proxy_when_direct_index_misses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Finnhub quote fallback does not synthesize index quotes from ETF proxies."""
    calls: list[str] = []
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")

    async def fake_symbol_quote(symbol: str, _token: str) -> market_indices.IndexQuote | None:
        calls.append(symbol)
        return None

    monkeypatch.setenv("FINNHUB_KEY", "token")
    monkeypatch.setattr(market_indices, "_fetch_finnhub_symbol_quote", fake_symbol_quote)

    quote = await market_indices._fetch_finnhub_quote(spx)

    assert quote is None
    assert calls == [spx.finnhub_symbol]


@pytest.mark.asyncio
async def test_index_quote_uses_fallback_provider_after_configured_providers_miss(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Global indices can refresh from Stooq when Yahoo cache and Finnhub miss."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")

    async def fake_empty_quote(_config: market_indices.IndexConfig) -> None:
        return None

    async def fake_stooq_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=3200.0, change_pct=1.5, previous_close=3152.71)

    monkeypatch.setattr(market_indices, "_fetch_finnhub_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_stooq_quote", fake_stooq_quote)

    quote = await market_indices._fetch_index_quote(sse)

    assert quote is not None
    assert quote.current == pytest.approx(3200.0)
    assert quote.change_pct == pytest.approx(1.5)
    assert quote.previous_close == pytest.approx(3152.71)


@pytest.mark.asyncio
async def test_index_quote_uses_yahoo_meta_cache_before_network_providers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Quote resolution is Yahoo-first when the chart fetch cached meta data."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    calls: list[str] = []
    market_indices._yahoo_meta_cache[sse.symbol] = market_indices.IndexQuote(
        current=3200.0,
        change_pct=1.0,
        previous_close=3168.32,
    )

    async def fake_finnhub_quote(_config: market_indices.IndexConfig) -> None:
        calls.append("finnhub")
        return None

    async def fake_stooq_quote(_config: market_indices.IndexConfig) -> None:
        calls.append("stooq")
        return None

    monkeypatch.setattr(market_indices, "_fetch_finnhub_quote", fake_finnhub_quote)
    monkeypatch.setattr(market_indices, "_fetch_stooq_quote", fake_stooq_quote)

    quote = await market_indices._fetch_index_quote(sse)

    assert quote is market_indices._yahoo_meta_cache[sse.symbol]
    assert calls == []


def test_dax_keeps_stooq_symbol_for_quote_fallback() -> None:
    """DAX can fall through to Stooq after Yahoo cache and Finnhub miss."""
    dax = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "DAX")

    assert dax.stooq_symbol == "^dax"


def test_us_indices_keep_direct_finnhub_index_symbols() -> None:
    """US indices use only direct Finnhub index symbols."""
    configs = {config.symbol: config for config in market_indices.INDEX_CONFIGS}

    assert configs["SPX"].finnhub_symbol == "^GSPC"
    assert configs["IXIC"].finnhub_symbol == "^IXIC"
    assert configs["DJI"].finnhub_symbol == "^DJI"


def test_market_index_fallback_baselines_match_current_ranges() -> None:
    """Fallback baselines stay close enough to real index ranges for candle sanity checks."""
    configs = {config.symbol: config for config in market_indices.INDEX_CONFIGS}

    assert configs["SPX"].fallback_value == pytest.approx(7500.00)
    assert configs["IXIC"].fallback_value == pytest.approx(26500.00)
    assert configs["DJI"].fallback_value == pytest.approx(50500.00)
    assert configs["SSE"].fallback_value == pytest.approx(4150.00)
    assert configs["HSI"].fallback_value == pytest.approx(25600.00)
    assert configs["N225"].fallback_value == pytest.approx(64900.00)
    assert configs["FTSE"].fallback_value == pytest.approx(10450.00)
    assert configs["DAX"].fallback_value == pytest.approx(25400.00)
    assert configs["KOSPI"].fallback_value == pytest.approx(8050.00)
    assert configs["TAIEX"].fallback_value == pytest.approx(43500.00)


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


@pytest.mark.asyncio
async def test_build_index_discards_us_etf_level_quote(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """ETF-level US prices are rejected without manufacturing chart data."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")

    async def fake_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=590.0, change_pct=0.5, previous_close=587.06)

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
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    index = await market_indices._build_index(spx)

    assert index.value == pytest.approx(spx.fallback_value)
    assert index.change_pct == pytest.approx(spx.fallback_change_pct)
    assert index.previous_close == pytest.approx(
        market_indices._previous_close_from_change(spx.fallback_value, spx.fallback_change_pct)
    )
    assert index.sparkline_24h == []
    assert "Discarding suspicious quote for SPX: got 590.00" in caplog.text


@pytest.mark.asyncio
async def test_build_index_sanitizes_etf_level_previous_close(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A correct index-level value cannot keep an ETF-level previous close."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")

    async def fake_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=5842.15, change_pct=886.0, previous_close=592.51)

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
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    index = await market_indices._build_index(spx)

    assert index.value == pytest.approx(5842.15)
    assert index.previous_close == pytest.approx(
        market_indices._previous_close_from_change(index.value, spx.fallback_change_pct)
    )
    assert index.change_pct == pytest.approx(spx.fallback_change_pct)
    assert abs(index.change_pct) < 15
    assert "Suspicious previous_close for SPX" in caplog.text


def test_market_cache_ttl_shortens_during_trading() -> None:
    """Market-index cache freshness uses a shorter TTL during live sessions."""
    assert market_indices._market_cache_ttl_seconds(datetime(2026, 5, 18, 14, 0, tzinfo=UTC)) == 15
    assert (
        market_indices._market_cache_ttl_seconds(datetime(2026, 5, 18, 22, 30, tzinfo=UTC)) == 120
    )
    assert (
        market_indices._market_cache_expiration_seconds(datetime(2026, 5, 18, 14, 0, tzinfo=UTC))
        == 300
    )
    assert (
        market_indices._market_cache_expiration_seconds(datetime(2026, 5, 18, 22, 30, tzinfo=UTC))
        == 300
    )


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
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )

    response = await market_indices.get_market_indices()

    assert response.indices[0].symbol == "SPX"
    assert response.updated_at == cached.updated_at


@pytest.mark.asyncio
async def test_read_intraday_from_redis_requires_enough_points(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Market-index refresh reads intraday points from Redis instead of providers."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 2, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(10)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_indices._read_intraday_from_redis(sse) == redis_points


@pytest.mark.asyncio
async def test_read_intraday_from_redis_filters_previous_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Redis candles from a previous trading day are not served as today's intraday chart."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 2, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 15, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(30)
    ]
    redis_points.extend(
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3300.0 + offset,
        )
        for offset in range(9)
    )

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_indices._read_intraday_from_redis(sse) is None


@pytest.mark.asyncio
async def test_read_intraday_from_redis_falls_back_to_pg_latest_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When Redis expires, 15-minute PostgreSQL candles reconstruct the latest session chart."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 8, 0, tzinfo=UTC))
    pg_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=15 * offset),
            3200.0 + offset,
        )
        for offset in range(10)
    ]

    async def fake_get_1d(_symbol: str) -> None:
        return None

    async def fake_pg_get(
        _symbol: str, interval: str, limit: int
    ) -> list[market_indices.IntradayPoint]:
        assert interval == "15m"
        assert limit == 100
        return pg_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)
    monkeypatch.setattr(market_candles, "_pg_get_candles", fake_pg_get)

    result = await market_indices._read_intraday_from_redis(sse)

    assert result is not None
    assert result[: len(pg_points)] == pg_points
    assert result == pg_points


@pytest.mark.asyncio
async def test_read_intraday_from_redis_falls_back_to_pg_most_recent_day(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Long-holiday reads can use the newest stored PostgreSQL candle date."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 25, 8, 0, tzinfo=UTC))
    pg_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 22, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=15 * offset),
            3200.0 + offset,
        )
        for offset in range(5)
    ]
    pg_points = [
        *[
            market_indices.IntradayPoint(
                datetime(2026, 5, 21, 9, 30, tzinfo=market_indices.BEIJING_TZ)
                + timedelta(minutes=15 * offset),
                3100.0 + offset,
            )
            for offset in range(5)
        ],
        *pg_points,
    ]

    async def fake_get_1d(_symbol: str) -> None:
        return None

    async def fake_pg_get(
        _symbol: str,
        _interval: str,
        limit: int,
    ) -> list[market_indices.IntradayPoint]:
        assert limit == 100
        return pg_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)
    monkeypatch.setattr(market_candles, "_pg_get_candles", fake_pg_get)

    result = await market_indices._read_intraday_from_redis(sse)

    assert result is not None
    assert result[:5] == pg_points[-5:]
    assert result == pg_points[-5:]


@pytest.mark.asyncio
async def test_read_intraday_from_redis_keeps_last_session_when_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed markets can still serve the latest full Redis session."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 17, 4, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 15, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(30)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    result = await market_indices._read_intraday_from_redis(sse)

    assert result is not None
    assert result[: len(redis_points)] == redis_points
    assert result == redis_points


@pytest.mark.asyncio
async def test_read_intraday_from_redis_rejects_sparse_closed_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed markets still reject Redis sessions below the minimum chart point threshold."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 17, 4, 0, tzinfo=UTC))
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 15, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(8)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_indices._read_intraday_from_redis(sse) is None


@pytest.mark.asyncio
async def test_read_intraday_from_redis_recovers_sparse_closed_session_from_5d(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sparse closed-session 1D Redis data is replaced by complete 5D Redis data."""
    kospi = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "KOSPI")
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 27, 7, 0, tzinfo=UTC))
    sparse_1d = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 27, 8, 0, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3000.0 + offset,
        )
        for offset in range(25)
    ]
    full_5d = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 27, 8, 0, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3100.0 + offset,
        )
        for offset in range(361)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return sparse_1d

    async def fake_get_5d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return full_5d

    async def fake_pg_get(
        _symbol: str, _interval: str, _limit: int
    ) -> list[market_indices.IntradayPoint]:
        raise AssertionError("5D Redis should satisfy the closed-market fallback")

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)
    monkeypatch.setattr(market_candles, "_redis_get_5d", fake_get_5d)
    monkeypatch.setattr(market_candles, "_pg_get_candles", fake_pg_get)

    result = await market_indices._read_intraday_from_redis(kospi)

    assert result is not None
    assert result == full_5d


@pytest.mark.asyncio
async def test_read_intraday_from_redis_keeps_last_session_before_open(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Weekday pre-open reads can still serve the latest full Redis session."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 0, 30, tzinfo=UTC)
    )
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 15, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3200.0 + offset,
        )
        for offset in range(30)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    result = await market_indices._read_intraday_from_redis(sse)

    assert result is not None
    assert result[: len(redis_points)] == redis_points
    assert result == redis_points


@pytest.mark.asyncio
async def test_read_intraday_from_redis_keeps_closed_session_points_unfilled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed-session reads return real candles without synthetic forward fill."""
    n225 = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "N225")
    morning_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 26, 8, 0, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            39000.0 + offset,
        )
        for offset in range(150)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return morning_points

    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 26, 8, 0, tzinfo=UTC))

    result = await market_indices._read_intraday_from_redis(n225)

    assert result == morning_points


@pytest.mark.asyncio
async def test_quote_falls_back_to_redis_candle(monkeypatch: pytest.MonkeyPatch) -> None:
    """Market-index refresh can derive a last-resort quote from Redis candles."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ), 3000.0
        ),
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 31, tzinfo=market_indices.BEIJING_TZ), 3030.0
        ),
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
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
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
async def test_build_index_syncs_value_to_real_intraday_when_quote_is_stale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Displayed values follow Redis candles when the quote has no fresher timestamp."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ), 3000.0
        ),
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 10, 30, tzinfo=market_indices.BEIJING_TZ), 3030.0
        ),
    ]
    range_inputs: list[tuple[float, float]] = []

    async def fake_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=3010.0, change_pct=0.33, previous_close=3000.0)

    async def fake_intraday(
        _config: market_indices.IndexConfig,
    ) -> list[market_indices.IntradayPoint]:
        return redis_points

    async def fake_historical(
        _config: market_indices.IndexConfig,
        value: float,
        change_pct: float,
    ) -> dict[str, market_indices.MarketSparkline]:
        range_inputs.append((value, change_pct))
        return {
            "5D": market_indices.MarketSparkline(
                values=[value],
                times=[redis_points[-1].timestamp.isoformat()],
            )
        }

    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)
    monkeypatch.setattr(market_indices, "_read_intraday_from_redis", fake_intraday)
    monkeypatch.setattr(market_indices, "_read_candle_ranges", fake_historical)

    index = await market_indices._build_index(sse)

    assert index.value == pytest.approx(3030.0)
    assert index.previous_close == pytest.approx(3000.0)
    assert index.change_pct == pytest.approx(1.0)
    assert index.sparkline_24h[-1] == pytest.approx(index.value)
    assert index.is_fallback_data is False
    assert len(range_inputs) == 1
    assert range_inputs[0][0] == pytest.approx(3030.0)
    assert range_inputs[0][1] == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_build_index_keeps_fresher_quote_over_stale_intraday(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Displayed values stay on timestamped live quotes when Redis intraday is older."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 9, 30, tzinfo=market_indices.BEIJING_TZ), 3000.0
        ),
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 10, 30, tzinfo=market_indices.BEIJING_TZ), 3030.0
        ),
    ]
    range_inputs: list[tuple[float, float]] = []

    async def fake_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(
            current=3040.0,
            change_pct=1.33,
            previous_close=3000.0,
            timestamp=datetime(2026, 5, 18, 10, 31, tzinfo=market_indices.BEIJING_TZ),
        )

    async def fake_intraday(
        _config: market_indices.IndexConfig,
    ) -> list[market_indices.IntradayPoint]:
        return redis_points

    async def fake_historical(
        _config: market_indices.IndexConfig,
        value: float,
        change_pct: float,
    ) -> dict[str, market_indices.MarketSparkline]:
        range_inputs.append((value, change_pct))
        return {}

    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)
    monkeypatch.setattr(market_indices, "_read_intraday_from_redis", fake_intraday)
    monkeypatch.setattr(market_indices, "_read_candle_ranges", fake_historical)

    index = await market_indices._build_index(sse)

    assert index.value == pytest.approx(3040.0)
    assert index.previous_close == pytest.approx(3000.0)
    assert index.change_pct == pytest.approx(1.33)
    assert index.sparkline_24h[-1] == pytest.approx(3030.0)
    assert len(range_inputs) == 1
    assert range_inputs[0][0] == pytest.approx(3040.0)
    assert range_inputs[0][1] == pytest.approx(1.33)


@pytest.mark.asyncio
async def test_yahoo_chart_result_uses_user_agent_and_query2_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    monkeypatch.setattr(market_indices, "_yahoo_crumb", "crumb")
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 999999.0)

    result = await market_indices._fetch_yahoo_chart_result(spx, params={}, purpose="test")

    assert isinstance(result, dict)
    assert result["meta"]["regularMarketPrice"] == pytest.approx(6000.0)
    assert market_indices._yahoo_meta_cache[spx.symbol].current == pytest.approx(6000.0)
    assert market_indices._yahoo_meta_cache[spx.symbol].previous_close == pytest.approx(5900.0)
    assert market_indices._yahoo_meta_cache[spx.symbol].change_pct == pytest.approx(
        100 / 5900 * 100
    )
    assert [url.split("/")[2] for url in calls] == [
        "query1.finance.yahoo.com",
        "query2.finance.yahoo.com",
    ]
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
    monkeypatch.setattr(market_indices, "_yahoo_crumb", "crumb")
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 999999.0)

    result = await market_indices._fetch_yahoo_chart_result(spx, params={}, purpose="test")

    assert result is None
    assert len(calls) == 1
    assert market_indices._yahoo_consecutive_429s == 1
    assert market_indices._yahoo_backoff_until > 0


@pytest.mark.asyncio
async def test_yahoo_backoff_logs_warning(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Yahoo backoff skips are visible in warning logs."""
    monkeypatch.setattr(market_indices._time, "monotonic", lambda: 10.0)
    monkeypatch.setattr(market_indices, "_yahoo_backoff_until", 70.0)
    monkeypatch.setattr(market_indices, "_yahoo_crumb", "crumb")
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 999999.0)
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    can_fetch = await market_indices._yahoo_rate_limit_wait()

    assert can_fetch is False
    assert "Yahoo backoff active, 60s remaining — candle fetch skipped." in caplog.text


@pytest.mark.asyncio
async def test_yahoo_backoff_counter_resets_after_window(monkeypatch: pytest.MonkeyPatch) -> None:
    """A naturally expired Yahoo backoff window clears the escalation counter."""
    slept: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    monkeypatch.setattr(market_indices._time, "monotonic", lambda: 200.0)
    monkeypatch.setattr(market_indices.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(market_indices, "_yahoo_backoff_until", 120.0)
    monkeypatch.setattr(market_indices, "_yahoo_consecutive_429s", 3)
    monkeypatch.setattr(market_indices, "_yahoo_last_request_time", 198.0)
    monkeypatch.setattr(market_indices, "_yahoo_crumb", "crumb")
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 999999.0)

    can_fetch = await market_indices._yahoo_rate_limit_wait()

    assert can_fetch is True
    assert market_indices._yahoo_consecutive_429s == 0
    assert slept == []
    assert market_indices.YAHOO_MAX_BACKOFF_SECONDS == 120


@pytest.mark.asyncio
async def test_yahoo_crumb_cancelled_error_is_suppressed(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Cancelled crumb fetches do not escape into scheduler refresh jobs."""

    async def fake_to_thread(_func: object) -> None:
        raise asyncio.CancelledError

    monkeypatch.setattr(market_indices.asyncio, "to_thread", fake_to_thread)
    monkeypatch.setattr(market_indices, "_yahoo_crumb", None)
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 0.0)
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    await market_indices._ensure_yahoo_crumb()

    assert "Yahoo crumb fetch was cancelled; continuing without crumb." in caplog.text


def test_yahoo_crumb_sync_fetches_cookie_and_crumb(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Yahoo crumb initialization stores the cookie jar and logs success."""
    import urllib.request

    opened_urls: list[str] = []
    timeouts: list[int] = []

    class FakeResponse:
        def __init__(self, body: bytes = b"") -> None:
            self.body = body

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    class FakeOpener:
        def open(self, request: urllib.request.Request, timeout: int) -> FakeResponse:
            opened_urls.append(request.full_url)
            timeouts.append(timeout)
            if "getcrumb" in request.full_url:
                return FakeResponse(b"crumb-value")
            return FakeResponse()

    monkeypatch.setattr(market_indices.urllib.request, "build_opener", lambda *_args: FakeOpener())
    monkeypatch.setattr(market_indices._time, "monotonic", lambda: 100.0)
    monkeypatch.setattr(market_indices, "_yahoo_crumb", None)
    monkeypatch.setattr(market_indices, "_yahoo_cookie_jar", None)
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 0.0)
    caplog.set_level("INFO", logger=market_indices.LOGGER.name)

    market_indices._ensure_yahoo_crumb_sync()

    assert opened_urls == [
        "https://fc.yahoo.com/",
        "https://query2.finance.yahoo.com/v1/test/getcrumb",
    ]
    assert timeouts == [5, 5]
    assert market_indices._yahoo_crumb == "crumb-value"
    assert market_indices._yahoo_cookie_jar is not None
    assert market_indices._yahoo_crumb_expires == pytest.approx(3700.0)
    assert "Yahoo crumb obtained successfully" in caplog.text


def test_yahoo_crumb_sync_ignores_fc_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    """fc.yahoo.com failures do not block the fallback crumb endpoint."""
    import urllib.request

    opened_urls: list[str] = []

    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return b"crumb-after-fc-error"

    class FakeOpener:
        def open(self, request: urllib.request.Request, timeout: int) -> FakeResponse:
            opened_urls.append(request.full_url)
            if request.full_url == "https://fc.yahoo.com/":
                raise OSError("fc unavailable")
            return FakeResponse()

    monkeypatch.setattr(market_indices.urllib.request, "build_opener", lambda *_args: FakeOpener())
    monkeypatch.setattr(market_indices._time, "monotonic", lambda: 100.0)
    monkeypatch.setattr(market_indices, "_yahoo_crumb", None)
    monkeypatch.setattr(market_indices, "_yahoo_cookie_jar", None)
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 0.0)

    market_indices._ensure_yahoo_crumb_sync()

    assert opened_urls == [
        "https://fc.yahoo.com/",
        "https://query2.finance.yahoo.com/v1/test/getcrumb",
    ]
    assert market_indices._yahoo_crumb == "crumb-after-fc-error"


def test_yahoo_crumb_sync_logs_and_suppresses_crumb_errors(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Crumb endpoint network errors are logged but never raised."""
    import urllib.request

    class FakeOpener:
        def open(self, _request: urllib.request.Request, timeout: int) -> object:
            raise OSError("network down")

    monkeypatch.setattr(market_indices.urllib.request, "build_opener", lambda *_args: FakeOpener())
    monkeypatch.setattr(market_indices, "_yahoo_crumb", None)
    monkeypatch.setattr(market_indices, "_yahoo_cookie_jar", None)
    monkeypatch.setattr(market_indices, "_yahoo_crumb_expires", 0.0)
    caplog.set_level("WARNING", logger=market_indices.LOGGER.name)

    market_indices._ensure_yahoo_crumb_sync()

    assert market_indices._yahoo_crumb is None
    assert "Yahoo crumb fetch failed: OSError: network down" in caplog.text


def test_yahoo_urllib_fetch_uses_cookie_jar_and_crumb(monkeypatch: pytest.MonkeyPatch) -> None:
    """Yahoo chart requests append crumb and use the cached cookie jar."""
    import urllib.request

    requested_urls: list[str] = []

    class FakeResponse:
        def read(self) -> bytes:
            return b'{"chart":{"result":[{"meta":{"regularMarketPrice":6000}}],"error":null}}'

    class FakeOpener:
        def open(self, request: urllib.request.Request, timeout: int) -> FakeResponse:
            requested_urls.append(request.full_url)
            return FakeResponse()

    cookie_jar = market_indices.http.cookiejar.MozillaCookieJar()
    monkeypatch.setattr(market_indices, "_yahoo_crumb", "crumb value")
    monkeypatch.setattr(market_indices, "_yahoo_cookie_jar", cookie_jar)
    monkeypatch.setattr(market_indices.urllib.request, "build_opener", lambda *_args: FakeOpener())

    result = market_indices._yahoo_urllib_fetch(
        "https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m",
        "test",
        "^GSPC",
        "query2.finance.yahoo.com",
    )

    assert isinstance(result, dict)
    assert result["meta"]["regularMarketPrice"] == 6000
    assert requested_urls == [
        "https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m&crumb=crumb%20value"
    ]


@pytest.mark.asyncio
async def test_refresh_market_indices_throttles_between_index_builds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 16, 0, tzinfo=market_indices.BEIJING_TZ), 6000.0
        ),
        market_indices.IntradayPoint(
            datetime(2026, 5, 19, 16, 0, tzinfo=market_indices.BEIJING_TZ), 6010.5
        ),
    ]

    await market_candles._redis_set_1d("SPX", points)
    await market_candles._redis_set_5d("SPX", points)
    cached_1d = await market_candles._redis_get_1d("SPX")
    cached = await market_candles._redis_get_5d("SPX")

    assert cached_1d == points
    assert cached == points
    assert stored["sigma:candles:1d:SPX:ttl"] == str(60 * 60 * 24 * 4)
    assert stored["sigma:candles:5d:SPX:ttl"] == str(market_candles.CANDLE_5D_TTL)


@pytest.mark.asyncio
async def test_candle_ranges_read_storage_without_yahoo_fetch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Historical ranges only read candle storage and return empty ranges when unavailable."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    redis_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 5990.0
        ),
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 21, 31, tzinfo=market_indices.BEIJING_TZ), 6000.0
        ),
    ]

    async def fake_redis_get_5d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return redis_points

    pg_calls: list[tuple[str, int]] = []

    async def fake_pg_get(
        _symbol: str, interval: str, limit: int
    ) -> list[market_indices.IntradayPoint]:
        assert limit > 0
        pg_calls.append((interval, limit))
        return []

    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 22, 30, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_redis_get_5d", fake_redis_get_5d)
    monkeypatch.setattr(market_candles, "_pg_get_candles", fake_pg_get)

    ranges = await market_indices._read_candle_ranges(spx, 6000.0, 1.0)

    assert ranges["5D"].values == [5990.0, 6000.0]
    assert ranges["1M"].values == []
    assert pg_calls == [("15m", 600), ("60m", 500), ("60m", 1800)]


@pytest.mark.asyncio
async def test_candle_ranges_use_pg_15m_when_redis_5d_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A missing Redis 5D cache can be reconstructed from PostgreSQL 15-minute candles."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    pg_15m = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=15 * offset),
            5900.0 + offset,
        )
        for offset in range(20)
    ]

    async def fake_redis_get_5d(_symbol: str) -> None:
        return None

    async def fake_pg_get(
        _symbol: str,
        interval: str,
        limit: int,
    ) -> list[market_indices.IntradayPoint]:
        assert limit > 0
        return pg_15m if interval == "15m" else []

    monkeypatch.setattr(market_candles, "_redis_get_5d", fake_redis_get_5d)
    monkeypatch.setattr(market_candles, "_pg_get_candles", fake_pg_get)

    ranges = await market_indices._read_candle_ranges(spx, 6000.0, 1.0)

    assert ranges["5D"].values == [round(point.value, 2) for point in pg_15m]
    assert ranges["1M"].values == [round(point.value, 2) for point in pg_15m]


@pytest.mark.asyncio
async def test_candle_job_runs_cold_start_piece_when_history_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The independent candle job fetches one Redis 1D cold-start piece during trading."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_redis_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return False

    async def fake_yahoo(
        _config: market_indices.IndexConfig, interval: str, range_: str
    ) -> list[market_indices.IntradayPoint]:
        calls.append(f"{interval}:{range_}")
        return [
            market_indices.IntradayPoint(
                datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 6000.0
            )
        ]

    async def fake_set_1d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set1d:{len(points)}")

    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 13, 31, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 13, 31, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_redis_has_fresh_1d)
    monkeypatch.setattr(market_candles, "_yahoo_fetch", fake_yahoo)
    monkeypatch.setattr(market_candles, "_redis_set_1d", fake_set_1d)

    await market_candles.candle_refresh_job()

    assert calls == ["1m:1d", "set1d:1"]
    market_candles._last_health_check = 0.0


@pytest.mark.asyncio
async def test_candle_job_processes_pending_cold_start_symbols_in_batches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cold start dispatches pending symbols and leaves Yahoo throttling to the semaphore."""
    configs = tuple(market_indices.INDEX_CONFIGS[:3])
    calls: list[str] = []

    async def fake_cold_start_fetch(config: market_indices.IndexConfig, _status: str) -> None:
        calls.append(config.symbol)

    market_candles._cold_start_done.clear()
    market_candles._last_fetch_time.clear()
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", configs)
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", configs)
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_cold_start_fetch", fake_cold_start_fetch)

    await market_candles.candle_refresh_job()

    assert calls == [config.symbol for config in configs]


@pytest.mark.asyncio
async def test_candle_job_runs_cold_start_batch_concurrently(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cold-start candle refresh can process two symbols at the same time."""
    configs = tuple(market_indices.INDEX_CONFIGS[:2])
    active = 0
    max_active = 0

    async def fake_cold_start_fetch(_config: market_indices.IndexConfig, _status: str) -> None:
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        await asyncio.sleep(0.01)
        active -= 1

    market_candles._cold_start_done.clear()
    market_candles._last_fetch_time.clear()
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", configs)
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", configs)
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_cold_start_fetch", fake_cold_start_fetch)

    await market_candles.candle_refresh_job()

    assert max_active == 2
    market_candles._last_health_check = 0.0


@pytest.mark.asyncio
async def test_candle_job_force_refetches_closed_market_once_after_yahoo_delay(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Any market gets one forced post-close refetch after Yahoo's delayed window expires."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[tuple[str, bool]] = []
    downsample_calls: list[str] = []

    async def fake_redis_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return True

    async def fake_fetch(
        config: market_indices.IndexConfig,
        backfill_intraday_gap: bool = True,
    ) -> int:
        calls.append((config.symbol, backfill_intraday_gap))
        return 390

    async def fake_downsample(config: market_indices.IndexConfig) -> None:
        downsample_calls.append(config.symbol)

    market_candles._cold_start_done.clear()
    market_candles._last_fetch_time.clear()
    market_candles._post_close_refetch_done.clear()
    market_candles._cold_start_done[spx.symbol] = True
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 26, 20, 15, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 26, 20, 15, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_redis_has_fresh_1d)
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch)
    monkeypatch.setattr(market_candles, "_end_of_day_downsample_if_needed", fake_downsample)

    await market_candles.candle_refresh_job()
    await market_candles.candle_refresh_job()

    assert calls == [("SPX", True)]
    assert downsample_calls == ["SPX", "SPX"]
    assert market_candles._post_close_refetch_done[spx.symbol] == date(2026, 5, 26)
    market_candles._last_health_check = 0.0


@pytest.mark.asyncio
async def test_candle_job_waits_before_closed_market_post_close_refetch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The delayed Yahoo refetch does not run before 15 minutes after close."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_redis_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return True

    async def fake_fetch(
        config: market_indices.IndexConfig,
        backfill_intraday_gap: bool = True,
    ) -> int:
        calls.append(f"{config.symbol}:{backfill_intraday_gap}")
        return 390

    async def fake_downsample(_config: market_indices.IndexConfig) -> None:
        return None

    market_candles._cold_start_done.clear()
    market_candles._last_fetch_time.clear()
    market_candles._post_close_refetch_done.clear()
    market_candles._cold_start_done[spx.symbol] = True
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 26, 20, 14, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 26, 20, 14, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_redis_has_fresh_1d)
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch)
    monkeypatch.setattr(market_candles, "_end_of_day_downsample_if_needed", fake_downsample)

    await market_candles.candle_refresh_job()

    assert calls == []
    assert spx.symbol not in market_candles._post_close_refetch_done
    market_candles._last_health_check = 0.0


def test_post_close_refetch_waits_until_last_session_close() -> None:
    """Split-session lunch breaks are not treated as the market's final close."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    lunch_break = datetime(2026, 5, 26, 4, 15, tzinfo=UTC).astimezone(market_indices.BEIJING_TZ)
    after_close = datetime(2026, 5, 26, 7, 15, tzinfo=UTC).astimezone(market_indices.BEIJING_TZ)

    assert market_candles._minutes_since_last_session_close(sse, lunch_break) is None
    assert market_candles._minutes_since_last_session_close(sse, after_close) == 15


def test_post_close_refetch_done_resets_when_market_date_changes() -> None:
    """The once-per-day post-close marker is cleared on the next local market date."""
    kospi = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "KOSPI")
    market_candles._post_close_refetch_done.clear()
    market_candles._post_close_refetch_done[kospi.symbol] = date(2026, 5, 26)

    market_candles._reset_post_close_refetch_done(
        datetime(2026, 5, 27, 7, 0, tzinfo=UTC).astimezone(market_indices.BEIJING_TZ)
    )

    assert kospi.symbol not in market_candles._post_close_refetch_done


@pytest.mark.asyncio
async def test_trading_fetch_backfills_sparse_1d_from_5d(monkeypatch: pytest.MonkeyPatch) -> None:
    """A mid-session Redis loss backfills today's 1D candles from Yahoo 5D data."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    stored_lengths: list[int] = []
    calls: list[str] = []
    sparse_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 26, 10, 25, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3100.0 + offset,
        )
        for offset in range(6)
    ]
    full_today = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 26, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3100.0 + offset,
        )
        for offset in range(61)
    ]
    previous_day = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 23, 9, 30, tzinfo=market_indices.BEIJING_TZ),
            3050.0,
        )
    ]

    async def fake_yahoo(
        _config: market_indices.IndexConfig,
        interval: str,
        range_: str,
    ) -> list[market_indices.IntradayPoint]:
        calls.append(f"{interval}:{range_}")
        return sparse_points if range_ == "1d" else [*previous_day, *full_today]

    async def fake_set_1d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        stored_lengths.append(len(points))

    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 26, 2, 30, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 26, 2, 30, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_yahoo_fetch", fake_yahoo)
    monkeypatch.setattr(market_candles, "_redis_set_1d", fake_set_1d)

    stored_count = await market_candles._fetch_and_store_1d_1min(sse)

    assert calls == ["1m:1d", "1m:5d"]
    assert stored_lengths == [61]
    assert stored_count == 61


def test_has_intraday_gap_checks_closed_market_full_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed markets still trigger gap backfill when cached intraday data is partial."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 26, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            4150.0 + offset,
        )
        for offset in range(20)
    ]

    closed_time = datetime(2026, 5, 26, 8, 0, tzinfo=UTC)
    monkeypatch.setattr(market_candles, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: closed_time)

    assert market_candles._is_trading(sse, closed_time) is False
    assert market_candles._has_intraday_gap(sse, points) is True


@pytest.mark.asyncio
async def test_fetch_and_store_1d_returns_empty_when_yahoo_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Yahoo 1D failures leave Redis empty instead of using ETF proxy candles."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_yahoo(_config: market_indices.IndexConfig, interval: str, range_: str) -> None:
        calls.append(f"yahoo:{interval}:{range_}")
        return None

    async def fake_set_1d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set1d:{len(points)}")

    monkeypatch.setattr(market_candles, "_yahoo_fetch", fake_yahoo)
    monkeypatch.setattr(market_candles, "_redis_set_1d", fake_set_1d)
    monkeypatch.setattr(market_candles, "_has_intraday_gap", lambda _config, _points: False)

    stored_count = await market_candles._fetch_and_store_1d_1min(spx)

    assert calls == ["yahoo:1m:1d"]
    assert stored_count == 0


@pytest.mark.asyncio
async def test_fetch_and_store_1d_discards_suspicious_candles(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Redis 1D storage rejects candles that are clearly outside the configured index range."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            15000.0 + offset,
        )
        for offset in range(10)
    ]
    calls: list[str] = []

    async def fake_yahoo(
        _config: market_indices.IndexConfig, interval: str, range_: str
    ) -> list[market_indices.IntradayPoint]:
        calls.append(f"yahoo:{interval}:{range_}")
        return points

    async def fake_set_1d(_symbol: str, _points: list[market_indices.IntradayPoint]) -> None:
        calls.append("set1d")

    monkeypatch.setattr(market_candles, "_yahoo_fetch", fake_yahoo)
    monkeypatch.setattr(market_candles, "_redis_set_1d", fake_set_1d)
    caplog.set_level("WARNING", logger=market_candles.LOGGER.name)

    stored_count = await market_candles._fetch_and_store_1d_1min(spx)

    assert stored_count == 0
    assert calls == ["yahoo:1m:1d"]
    assert "Discarding suspicious candle data for SPX" in caplog.text


@pytest.mark.asyncio
async def test_cold_start_pieces_fill_redis_before_postgres_intervals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cold start fills Redis 1D/5D before PostgreSQL 15m/60m intervals."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []
    point = market_indices.IntradayPoint(
        datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 6000.0
    )
    state = {"has_1d": False, "has_5d": False, "has_15m": False, "has_60m": False}

    async def fake_yahoo(
        _config: market_indices.IndexConfig, interval: str, range_: str
    ) -> list[market_indices.IntradayPoint]:
        calls.append(f"{interval}:{range_}")
        return [point]

    async def fake_upsert(
        _symbol: str, interval: str, points: list[market_indices.IntradayPoint]
    ) -> None:
        calls.append(f"upsert:{interval}:{len(points)}")

    async def fake_set_5d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set5d:{len(points)}")

    async def fake_set_1d(_symbol: str, points: list[market_indices.IntradayPoint]) -> None:
        calls.append(f"set1d:{len(points)}")
        state["has_1d"] = True

    async def fake_has_1d(_config: market_indices.IndexConfig) -> bool:
        return state["has_1d"]

    async def fake_has_5d(_config: market_indices.IndexConfig) -> bool:
        return state["has_5d"]

    async def fake_has_interval(_symbol: str, interval: str) -> bool:
        return bool(state[f"has_{interval}"])

    async def fake_set_5d_with_state(
        _symbol: str, points: list[market_indices.IntradayPoint]
    ) -> None:
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
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_has_1d)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_5d", fake_has_5d)
    monkeypatch.setattr(market_candles, "_pg_has_interval", fake_has_interval)
    monkeypatch.setattr(market_candles, "_filter_today", lambda _config, points: points)
    monkeypatch.setattr(market_candles, "_has_intraday_gap", lambda _config, _points: False)

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
async def test_cold_start_resets_failed_steps_when_no_data_was_stored(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Cold start does not mark a symbol complete when every step failed."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_fetch_1d(
        _config: market_indices.IndexConfig, backfill_intraday_gap: bool = False
    ) -> int:
        calls.append(f"1d:{backfill_intraday_gap}")
        return 0

    async def fake_yahoo(_config: market_indices.IndexConfig, interval: str, range_: str) -> None:
        calls.append(f"{interval}:{range_}")
        return None

    async def fake_false(*_args: object) -> bool:
        return False

    market_candles._cold_start_attempts.clear()
    market_candles._cold_start_done.clear()
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch_1d)
    monkeypatch.setattr(market_candles, "_yahoo_fetch", fake_yahoo)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_false)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_5d", fake_false)
    monkeypatch.setattr(market_candles, "_pg_has_interval", fake_false)
    caplog.set_level("WARNING", logger=market_candles.LOGGER.name)

    for _ in range(13):
        await market_candles._cold_start_next_piece(spx)

    assert calls.count("1d:True") == 3
    assert calls.count("1m:5d") == 3
    assert calls.count("15m:1mo") == 3
    assert calls.count("60m:1y") == 3
    assert market_candles._cold_start_done.get(spx.symbol) is None
    assert market_candles._cold_start_attempts == {}
    assert "Skipping 1D cold start for SPX after 3 failed attempts." in caplog.text
    assert "Skipping 60m cold start for SPX after 3 failed attempts." in caplog.text
    assert "Cold start for SPX completed all steps but stored no data." in caplog.text
    market_candles._cold_start_attempts.clear()
    market_candles._cold_start_done.clear()


@pytest.mark.asyncio
async def test_redis_freshness_checks_reject_stale_candle_sets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cold start freshness checks reject previous-session Redis leftovers."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    current_points = [
        market_indices.IntradayPoint(timestamp=timestamp, value=3100.0 + offset)
        for offset, timestamp in enumerate(
            market_indices._trading_minutes(sse, datetime(2026, 5, 26).date())
        )
    ]
    stale_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 25, 9, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3050.0 + offset,
        )
        for offset in range(10)
    ]
    one_day_cache: list[market_indices.IntradayPoint] | None = stale_points
    five_day_cache: list[market_indices.IntradayPoint] | None = current_points

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint] | None:
        return one_day_cache

    async def fake_get_5d(_symbol: str) -> list[market_indices.IntradayPoint] | None:
        return five_day_cache

    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 26, 8, 0, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)
    monkeypatch.setattr(market_candles, "_redis_get_5d", fake_get_5d)

    assert await market_candles._redis_has_fresh_1d(sse) is False
    assert await market_candles._redis_has_fresh_5d(sse) is False

    one_day_cache = current_points
    five_day_cache = [*stale_points, *current_points]

    assert await market_candles._redis_has_fresh_1d(sse) is True
    assert await market_candles._redis_has_fresh_5d(sse) is True


@pytest.mark.asyncio
async def test_redis_freshness_rejects_morning_only_closed_multi_session_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed split-session markets refetch when Redis only has morning candles."""
    n225 = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "N225")
    morning_points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 26, 8, 0, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            39000.0 + offset,
        )
        for offset in range(151)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return morning_points

    closed_time = datetime(2026, 5, 26, 8, 0, tzinfo=UTC)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_candles._redis_has_fresh_1d(n225) is False


@pytest.mark.asyncio
async def test_redis_freshness_accepts_complete_closed_multi_session_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed split-session markets stay warm when Redis covers the full session day."""
    n225 = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "N225")
    complete_points = [
        market_indices.IntradayPoint(timestamp=timestamp, value=39000.0 + offset)
        for offset, timestamp in enumerate(
            market_indices._trading_minutes(n225, datetime(2026, 5, 26).date())
        )
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return complete_points

    closed_time = datetime(2026, 5, 26, 8, 0, tzinfo=UTC)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_candles._redis_has_fresh_1d(n225) is True


@pytest.mark.asyncio
async def test_redis_freshness_rejects_incomplete_closed_single_session_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed single-session markets use coverage, not just the 10-point floor."""
    kospi = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "KOSPI")
    points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 26, 8, 0, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
            3900.0 + offset,
        )
        for offset in range(30)
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return points

    closed_time = datetime(2026, 5, 26, 7, 0, tzinfo=UTC)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_candles._redis_has_fresh_1d(kospi) is False


@pytest.mark.asyncio
async def test_redis_freshness_accepts_high_coverage_closed_single_session_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed single-session markets stay warm once Redis covers nearly all trading minutes."""
    kospi = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "KOSPI")
    points = [
        market_indices.IntradayPoint(timestamp=timestamp, value=3900.0 + offset)
        for offset, timestamp in enumerate(
            market_indices._trading_minutes(kospi, datetime(2026, 5, 26).date())[:360]
        )
    ]

    async def fake_get_1d(_symbol: str) -> list[market_indices.IntradayPoint]:
        return points

    closed_time = datetime(2026, 5, 26, 7, 0, tzinfo=UTC)
    monkeypatch.setattr(market_indices, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_now_utc", lambda: closed_time)
    monkeypatch.setattr(market_candles, "_redis_get_1d", fake_get_1d)

    assert await market_candles._redis_has_fresh_1d(kospi) is True


@pytest.mark.asyncio
async def test_candle_job_health_check_resets_done_symbol_without_fresh_data(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Periodic health checks recover symbols that were marked done without usable Redis data."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")

    async def fake_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return False

    async def fake_fetch_1d(_config: market_indices.IndexConfig) -> int:
        return 0

    market_candles._cold_start_done.clear()
    market_candles._cold_start_attempts.clear()
    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done[spx.symbol] = True
    market_candles._cold_start_attempts[market_candles._cold_start_step_key(spx.symbol, "1D")] = 4
    market_candles._last_health_check = 0.0

    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 13, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 13, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles._time, "monotonic", lambda: 1000.0)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_has_fresh_1d)
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch_1d)
    caplog.set_level("WARNING", logger=market_candles.LOGGER.name)

    await market_candles.candle_refresh_job()

    assert market_candles._cold_start_done[spx.symbol] is False
    assert market_candles._cold_start_attempts == {}
    assert "Health check: SPX has no fresh 1D data. Resetting cold start." in caplog.text

    market_candles._cold_start_done.clear()
    market_candles._last_fetch_time.clear()
    market_candles._last_health_check = 0.0


@pytest.mark.asyncio
async def test_end_of_day_downsamples_to_fifteen_and_sixty_minute_intervals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-of-day storage writes only the upgraded PostgreSQL candle intervals."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(minutes=offset),
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

    async def fake_upsert(
        _symbol: str, interval: str, stored: list[market_indices.IntradayPoint]
    ) -> None:
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
    """Trading markets have independent 10-second 1-minute fetch timers."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    async def fake_has_full_year(_symbol: str) -> bool:
        return True

    async def fake_fetch_1d(_config: market_indices.IndexConfig) -> None:
        calls.append("fetch")

    async def fake_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return True

    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._cold_start_done[spx.symbol] = True
    market_candles._last_health_check = 0.0
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (spx,))
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 14, 0, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_pg_has_full_year", fake_has_full_year)
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch_1d)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_has_fresh_1d)

    await market_candles.candle_refresh_job()
    await market_candles.candle_refresh_job()

    assert calls == ["fetch"]
    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._last_health_check = 0.0


@pytest.mark.asyncio
async def test_candle_job_warms_pre_market_once(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pre-market symbols fetch once only when their 1D Redis cache is missing."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    calls: list[str] = []

    async def fake_fetch_1d(_config: market_indices.IndexConfig) -> int:
        calls.append("fetch")
        return 1

    async def fake_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return bool(calls)

    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._cold_start_done[sse.symbol] = True
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (sse,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (sse,))
    monkeypatch.setattr(
        market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 0, 45, tzinfo=UTC)
    )
    monkeypatch.setattr(
        market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 0, 45, tzinfo=UTC)
    )
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch_1d)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_has_fresh_1d)

    await market_candles.candle_refresh_job()
    await market_candles.candle_refresh_job()

    assert calls == ["fetch"]
    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()


@pytest.mark.asyncio
async def test_candle_job_skips_closed_market_with_fresh_redis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed symbols with fresh 1D data do not spend Yahoo calls."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    calls: list[str] = []

    async def fake_fetch_1d(_config: market_indices.IndexConfig) -> int:
        calls.append("fetch")
        return 1

    async def fake_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return True

    async def fake_downsample(_config: market_indices.IndexConfig) -> None:
        calls.append("eod")

    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._cold_start_done[sse.symbol] = True
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (sse,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (sse,))
    monkeypatch.setattr(market_indices, "_now_utc", lambda: datetime(2026, 5, 18, 8, 0, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_now_utc", lambda: datetime(2026, 5, 18, 8, 0, tzinfo=UTC))
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch_1d)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_has_fresh_1d)
    monkeypatch.setattr(market_candles, "_end_of_day_downsample_if_needed", fake_downsample)

    await market_candles.candle_refresh_job()

    assert calls == ["eod"]
    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()


@pytest.mark.asyncio
async def test_candle_job_retries_closed_market_shortly_after_close_even_when_fresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Post-close retries pick up delayed Yahoo candles even if Redis already looks fresh."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")
    calls: list[datetime] = []
    now_values = [
        datetime(2026, 5, 18, 7, 1, tzinfo=UTC),
        datetime(2026, 5, 18, 7, 2, tzinfo=UTC),
        datetime(2026, 5, 18, 7, 3, tzinfo=UTC),
        datetime(2026, 5, 18, 7, 10, tzinfo=UTC),
    ]
    now_index = 0

    def fake_now() -> datetime:
        return now_values[now_index]

    async def fake_fetch_1d(_config: market_indices.IndexConfig) -> int:
        calls.append(fake_now())
        return 1

    async def fake_has_fresh_1d(_config: market_indices.IndexConfig) -> bool:
        return True

    async def fake_downsample(_config: market_indices.IndexConfig) -> None:
        return None

    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._post_close_retry_slots.clear()
    market_candles._cold_start_done[sse.symbol] = True
    market_candles._last_health_check = market_candles._time.monotonic()
    monkeypatch.setattr(market_indices, "INDEX_CONFIGS", (sse,))
    monkeypatch.setattr(market_candles, "INDEX_CONFIGS", (sse,))
    monkeypatch.setattr(market_indices, "_now_utc", fake_now)
    monkeypatch.setattr(market_candles, "_now_utc", fake_now)
    monkeypatch.setattr(market_candles, "_fetch_and_store_1d_1min", fake_fetch_1d)
    monkeypatch.setattr(market_candles, "_redis_has_fresh_1d", fake_has_fresh_1d)
    monkeypatch.setattr(market_candles, "_end_of_day_downsample_if_needed", fake_downsample)

    for index in range(len(now_values)):
        now_index = index
        await market_candles.candle_refresh_job()

    assert calls == [now_values[0], now_values[2]]
    market_candles._last_fetch_time.clear()
    market_candles._cold_start_done.clear()
    market_candles._post_close_retry_slots.clear()


def test_trim_to_trading_days_uses_exchange_timezone() -> None:
    """The rolling 5D cache groups cross-midnight Beijing points by exchange date."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")
    points = [
        market_indices.IntradayPoint(
            datetime(2026, 5, 11, 21, 30, tzinfo=market_indices.BEIJING_TZ)
            + timedelta(days=offset),
            5000.0 + offset,
        )
        for offset in range(7)
    ]

    trimmed = market_candles._trim_to_n_trading_days(spx, points, n=5)

    assert len(trimmed) == 5
    assert trimmed[0] == points[2]
    assert trimmed[-1] == points[-1]


@pytest.mark.asyncio
async def test_sparse_intraday_series_logs_warning(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Sparse intraday provider data is visible in logs before charts flatten out."""
    spx = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SPX")

    async def fake_quote(_config: market_indices.IndexConfig) -> market_indices.IndexQuote:
        return market_indices.IndexQuote(current=6000.0, change_pct=1.0, previous_close=5940.0)

    async def fake_intraday(
        _config: market_indices.IndexConfig,
    ) -> list[market_indices.IntradayPoint]:
        return [
            market_indices.IntradayPoint(
                datetime(2026, 5, 18, 21, 30, tzinfo=market_indices.BEIJING_TZ), 5990.0
            ),
            market_indices.IntradayPoint(
                datetime(2026, 5, 18, 21, 31, tzinfo=market_indices.BEIJING_TZ), 6000.0
            ),
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
async def test_refresh_job_respects_fresh_market_index_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
