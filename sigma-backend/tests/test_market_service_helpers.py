from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_candle import MarketCandle
from app.services.market import candle_store, candles, index_cache, index_quotes, indices
from app.services.market.types import IntradayPoint


@pytest.mark.asyncio
async def test_index_cache_reads_writes_and_handles_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Index cache helpers round-trip Redis values and swallow cache failures."""
    stored: dict[str, tuple[str, int | None]] = {}

    class FakeRedis:
        def __init__(self, fail: bool = False) -> None:
            self.fail = fail

        async def get(self, key: str) -> str | None:
            if self.fail:
                raise RuntimeError("cache offline")
            payload = stored.get(key)
            return payload[0] if payload else None

        async def set(self, key: str, value: str, ex: int | None = None) -> None:
            if self.fail:
                raise RuntimeError("cache offline")
            stored[key] = (value, ex)

        async def aclose(self) -> None:
            return None

    monkeypatch.setattr(index_cache, "create_redis_client", FakeRedis)
    monkeypatch.setattr(index_cache, "any_market_trading_now", lambda _now=None: True)

    payload = '{"indices":[]}'
    await index_cache._cache_set(payload)

    assert await index_cache._cache_get() == payload
    assert stored[index_cache.CACHE_KEY][1] == index_cache.STALE_CACHE_TTL_SECONDS
    assert index_cache.decode_cached_payload(payload) == {"indices": []}
    assert index_cache._market_cache_ttl_seconds() == index_cache.ACTIVE_CACHE_TTL_SECONDS
    assert index_cache._market_cache_expiration_seconds() == index_cache.STALE_CACHE_TTL_SECONDS

    monkeypatch.setattr(index_cache, "create_redis_client", lambda: FakeRedis(fail=True))

    assert await index_cache._cache_get() is None
    await index_cache._cache_set("ignored")


def test_index_cache_detects_fresh_and_invalid_payloads() -> None:
    """Cached market payload freshness follows update age and JSON validity."""
    now = datetime(2026, 5, 30, 12, 0, tzinfo=UTC)
    fresh = indices.MarketIndicesResponse(indices=[], updated_at=now).model_dump_json()
    stale = indices.MarketIndicesResponse(
        indices=[],
        updated_at=now - timedelta(seconds=index_cache.STALE_CACHE_TTL_SECONDS + 1),
    ).model_dump_json()

    assert index_cache._cached_payload_is_fresh(fresh, now) is True
    assert index_cache._cached_payload_is_fresh(stale, now) is False
    assert index_cache._cached_payload_is_fresh("not-json", now) is False


@pytest.mark.asyncio
async def test_index_quotes_parse_finnhub_and_stooq_responses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Quote provider helpers map successful JSON and CSV provider responses."""
    spx = next(config for config in indices.INDEX_CONFIGS if config.symbol == "SPX")

    class FakeResponse:
        def __init__(self, payload: dict[str, Any] | None = None, text: str = "") -> None:
            self._payload = payload or {}
            self.text = text

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return self._payload

    class FakeClient:
        def __init__(self, *_args: Any, **_kwargs: Any) -> None:
            return None

        async def __aenter__(self) -> "FakeClient":
            return self

        async def __aexit__(self, *_args: Any) -> None:
            return None

        async def get(self, url: str, **_kwargs: Any) -> FakeResponse:
            if "finnhub" in url:
                return FakeResponse({"c": 110.0, "pc": 100.0, "t": 1_800_000_000})
            return FakeResponse(
                text="Symbol,Date,Time,Open,High,Low,Close,Volume,Prev\n"
                "SPX,2026-05-29,15:59:00,1,1,1,120.00,0,100.00\n"
            )

    monkeypatch.setattr(index_quotes.httpx, "AsyncClient", FakeClient)

    finnhub = await index_quotes._fetch_finnhub_symbol_quote("SPX", "token")
    stooq = await index_quotes._fetch_stooq_quote(spx)

    assert finnhub is not None
    assert finnhub.current == 110.0
    assert finnhub.change_pct == pytest.approx(10.0)
    assert stooq is not None
    assert stooq.current == 120.0
    assert stooq.previous_close == 100.0


@pytest.mark.asyncio
async def test_index_quotes_handle_provider_misses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Quote provider helpers return None for missing tokens, bad payloads, and HTTP errors."""
    spx = next(config for config in indices.INDEX_CONFIGS if config.symbol == "SPX")
    calls: list[str] = []

    class FailingClient:
        def __init__(self, *_args: Any, **_kwargs: Any) -> None:
            return None

        async def __aenter__(self) -> "FailingClient":
            return self

        async def __aexit__(self, *_args: Any) -> None:
            return None

        async def get(self, *_args: Any, **_kwargs: Any) -> Any:
            raise httpx.HTTPError("provider down")

    async def fake_finnhub(_config: indices.IndexConfig) -> None:
        calls.append("finnhub")
        return None

    async def fake_stooq(_config: indices.IndexConfig) -> None:
        calls.append("stooq")
        return None

    monkeypatch.delenv("FINNHUB_KEY", raising=False)
    monkeypatch.setattr(index_quotes.httpx, "AsyncClient", FailingClient)
    monkeypatch.setattr(indices, "_fetch_finnhub_quote", fake_finnhub)
    monkeypatch.setattr(indices, "_fetch_stooq_quote", fake_stooq)
    index_quotes._yahoo_meta_cache.pop(spx.symbol, None)

    assert await index_quotes._fetch_finnhub_quote(spx) is None
    assert await index_quotes._fetch_finnhub_symbol_quote("SPX", "token") is None
    assert await index_quotes._fetch_stooq_quote(spx) is None
    assert await index_quotes._fetch_index_quote(spx) is None
    assert calls == ["finnhub", "stooq"]


@pytest.mark.asyncio
async def test_index_quote_can_be_derived_from_redis_candles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Redis 1D candle data can produce a last-resort quote."""
    spx = next(config for config in indices.INDEX_CONFIGS if config.symbol == "SPX")
    points = [
        IntradayPoint(datetime(2026, 5, 29, 21, 30, tzinfo=indices.BEIJING_TZ), 100.0),
        IntradayPoint(datetime(2026, 5, 29, 21, 31, tzinfo=indices.BEIJING_TZ), 103.0),
    ]

    async def fake_get_1d(_symbol: str) -> list[IntradayPoint]:
        return points

    monkeypatch.setattr(candles, "_redis_get_1d", fake_get_1d)

    quote = await index_quotes._quote_from_redis_candle(spx)

    assert quote is not None
    assert quote.current == 103.0
    assert quote.change_pct == pytest.approx(3.0)


@pytest.mark.asyncio
async def test_candle_store_persists_reads_and_prunes_candles(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Candle storage helpers upsert, query, and prune persisted candle rows."""
    fixed_now = datetime(2026, 5, 30, 12, 0, tzinfo=UTC)

    class SessionContext:
        async def __aenter__(self) -> AsyncSession:
            return db_session

        async def __aexit__(self, *_args: Any) -> None:
            return None

    monkeypatch.setattr(candle_store, "AsyncSessionLocal", SessionContext)
    monkeypatch.setattr(candles, "_now_utc", lambda: fixed_now)

    points = [
        IntradayPoint(fixed_now - timedelta(minutes=30), 100.0),
        IntradayPoint(fixed_now - timedelta(minutes=15), 101.0),
        IntradayPoint(fixed_now, 102.0),
    ]
    old = MarketCandle(
        symbol="SPX",
        interval="15m",
        timestamp=fixed_now - timedelta(days=400),
        close=99.0,
    )
    db_session.add(old)
    await db_session.commit()

    await candle_store._pg_upsert_candles("SPX", "15m", points)
    await candle_store._pg_upsert_candles("SPX", "15m", points)
    has_interval = await candle_store._pg_has_interval("SPX", "15m")
    has_date = await candle_store._pg_has_date("SPX", "15m", fixed_now.date())
    has_full_year = await candle_store._pg_has_full_year("SPX")
    read_back = await candle_store._pg_get_candles("SPX", "15m", limit=10)
    await candle_store._pg_delete_older_than_1y("SPX")
    remaining = list(
        await db_session.scalars(select(MarketCandle).where(MarketCandle.symbol == "SPX"))
    )
    downsampled = candle_store._downsample(points, minutes=30)

    assert has_interval is True
    assert has_date is True
    assert has_full_year is False
    assert [point.value for point in read_back] == [99.0, 100.0, 101.0, 102.0]
    assert len(remaining) == 3
    assert [point.value for point in downsampled] == [101.0, 102.0]


@pytest.mark.asyncio
async def test_candle_store_integrity_check_deletes_corrupted_ranges(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Integrity check removes candle rows far outside an index's expected range."""
    spx = next(config for config in indices.INDEX_CONFIGS if config.symbol == "SPX")

    class SessionContext:
        async def __aenter__(self) -> AsyncSession:
            return db_session

        async def __aexit__(self, *_args: Any) -> None:
            return None

    monkeypatch.setattr(candle_store, "AsyncSessionLocal", SessionContext)
    db_session.add(
        MarketCandle(
            symbol=spx.symbol,
            interval="15m",
            timestamp=datetime(2026, 5, 30, 12, 0, tzinfo=UTC),
            close=spx.fallback_value * 3,
        )
    )
    await db_session.commit()

    await candle_store._check_pg_candle_integrity()

    remaining = list(
        await db_session.scalars(select(MarketCandle).where(MarketCandle.symbol == spx.symbol))
    )
    assert remaining == []
