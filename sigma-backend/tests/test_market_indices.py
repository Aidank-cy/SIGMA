from datetime import UTC, datetime

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

    monkeypatch.setattr(market_indices, "_cache_get", fake_cache_get)
    monkeypatch.setattr(market_indices, "_cache_set", fake_cache_set)
    monkeypatch.setattr(market_indices, "_fetch_index_quote", fake_quote)

    response = await list_market_indices()

    assert {index.symbol for index in response} == {
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
    lengths = {index.symbol: len(index.sparkline_24h) for index in response}
    assert lengths["SSE"] == 242
    assert lengths["HSI"] == 332
    assert lengths["N225"] == 332
    assert all(len(index.sparkline_24h) == len(index.sparkline_times) for index in response)
    assert {index.symbol: index.currency for index in response}["SPX"] == "USD"
    assert {index.symbol: index.currency for index in response}["SSE"] == "CNY"
    sse = next(index for index in response if index.symbol == "SSE")
    assert [session.open for session in sse.trading_hours.sessions] == ["09:30", "13:00"]
    assert sse.sparkline_times[0].endswith("09:30:00+08:00")
    assert sse.sparkline_times[120].endswith("11:30:00+08:00")
    assert sse.sparkline_times[121].endswith("13:00:00+08:00")
    assert market_indices.decode_cached_payload(cache["payload"])["indices"][0]["symbol"] == "SPX"
    assert market_indices.decode_cached_payload(cache["payload"])["indices"][0]["currency"] == "USD"


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

    async def fake_symbol_quote(symbol: str, _token: str) -> tuple[float, float] | None:
        calls.append(symbol)
        if symbol == spx.finnhub_symbol:
            return None
        return 550.0, 2.0

    monkeypatch.setenv("FINNHUB_KEY", "token")
    monkeypatch.setattr(market_indices, "_fetch_finnhub_symbol_quote", fake_symbol_quote)

    quote = await market_indices._fetch_finnhub_quote(spx)

    assert quote == pytest.approx((spx.fallback_value * 1.02, 2.0))
    assert calls == [spx.finnhub_symbol, spx.finnhub_proxy_symbol]


@pytest.mark.asyncio
async def test_index_quote_uses_fallback_provider_after_configured_providers_miss(monkeypatch: pytest.MonkeyPatch) -> None:
    """Global indices can refresh when Finnhub and Alpha do not cover the symbol."""
    sse = next(config for config in market_indices.INDEX_CONFIGS if config.symbol == "SSE")

    async def fake_empty_quote(_config: market_indices.IndexConfig) -> None:
        return None

    async def fake_stooq_quote(_config: market_indices.IndexConfig) -> tuple[float, float]:
        return 3200.0, 1.5

    monkeypatch.setattr(market_indices, "_fetch_finnhub_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_alpha_vantage_quote", fake_empty_quote)
    monkeypatch.setattr(market_indices, "_fetch_stooq_quote", fake_stooq_quote)

    assert await market_indices._fetch_index_quote(sse) == (3200.0, 1.5)


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
    """Scheduler registers one refresh job for the ticker strip cache."""
    scheduler.remove_all_jobs()

    add_market_indices_job()

    assert scheduler.get_job("market-indices:refresh") is not None
    scheduler.remove_all_jobs()
