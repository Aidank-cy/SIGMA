import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes.stats import get_last_collection, get_sentiment_stats, get_trending_keywords
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, IntelligenceCategory, Market, SourceType


def test_stats_http_endpoints_return_machine_consumable_payloads(client: TestClient) -> None:
    """Stats endpoints return HTTP payloads for sentiment, trending keywords, and collection freshness."""
    latest = asyncio.run(_seed_stats_http_data(client))

    sentiment_response = client.get("/api/v1/stats/sentiment")
    trending_response = client.get("/api/v1/stats/trending-keywords")
    collection_response = client.get("/api/v1/stats/last-collection")

    assert sentiment_response.status_code == 200
    assert sentiment_response.json() == {"bullish_pct": 50}

    assert trending_response.status_code == 200
    trending_payload = trending_response.json()
    assert trending_payload["items"][0] == {"keyword": "AI", "count": 2}
    assert all({"keyword", "count"}.issubset(item) for item in trending_payload["items"])

    assert collection_response.status_code == 200
    last_success = collection_response.json()["last_success"]
    assert isinstance(last_success, str)
    assert last_success.startswith(latest.replace(tzinfo=None).isoformat(timespec="seconds"))


@pytest.mark.asyncio
async def test_sentiment_stats_uses_metadata_and_text_fallback(db_session: AsyncSession) -> None:
    """Sentiment stats aggregate structured metadata and summary terms."""
    source = _source()
    db_session.add(source)
    db_session.add_all(
        [
            _item(source, "A", "Strong growth and gains", {"sentiment": "bullish"}),
            _item(source, "B", "Bearish risk and losses", None),
            _item(source, "C", "Neutral policy update", {"sentiment": "neutral"}),
        ]
    )
    await db_session.commit()

    response = await get_sentiment_stats(db=db_session)

    assert response.bullish_pct == 33


@pytest.mark.asyncio
async def test_sentiment_stats_filters_by_days(db_session: AsyncSession) -> None:
    """Sentiment stats can be scoped to a selected recent range."""
    source = _source()
    db_session.add(source)
    db_session.add_all(
        [
            _item(source, "Recent", "Strong growth and gains", {"sentiment": "bullish"}),
            _item(
                source,
                "Old",
                "Bearish risk and losses",
                {"sentiment": "bearish"},
                collected_at=datetime.now(timezone.utc) - timedelta(days=10),
            ),
        ]
    )
    await db_session.commit()

    response = await get_sentiment_stats(days=7, db=db_session)

    assert response.bullish_pct == 100


@pytest.mark.asyncio
async def test_trending_keywords_prefers_metadata_keywords(db_session: AsyncSession) -> None:
    """Trending keyword stats use extracted keywords when present."""
    source = _source()
    db_session.add(source)
    db_session.add_all(
        [
            _item(source, "Semiconductor market rally", "chip demand growth", {"keywords": ["chips", "AI"]}),
            _item(source, "AI demand expands", "strong chips cycle", {"keywords": ["chips", "AI"]}),
        ]
    )
    await db_session.commit()

    response = await get_trending_keywords(db=db_session)

    assert response.items[0].keyword == "chips"
    assert response.items[0].count == 2


@pytest.mark.asyncio
async def test_trending_keywords_filters_by_days(db_session: AsyncSession) -> None:
    """Trending keyword stats use the selected recent window."""
    source = _source()
    db_session.add(source)
    db_session.add_all(
        [
            _item(source, "Recent AI demand", "growth", {"keywords": ["AI"]}),
            _item(
                source,
                "Old chips demand",
                "growth",
                {"keywords": ["chips"]},
                collected_at=datetime.now(timezone.utc) - timedelta(days=10),
            ),
        ]
    )
    await db_session.commit()

    response = await get_trending_keywords(days=7, db=db_session)

    assert [item.keyword for item in response.items] == ["AI"]


@pytest.mark.asyncio
async def test_last_collection_returns_latest_success(db_session: AsyncSession) -> None:
    """Last collection stats return the latest successful collector timestamp."""
    source = _source()
    older = datetime.now(timezone.utc) - timedelta(hours=2)
    latest = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.add(source)
    db_session.add_all(
        [
            _log(source, CollectorStatus.SUCCESS, older),
            _log(source, CollectorStatus.FAIL, datetime.now(timezone.utc)),
            _log(source, CollectorStatus.SUCCESS, latest),
        ]
    )
    await db_session.commit()

    response = await get_last_collection(db_session)

    assert response.last_success == latest.isoformat()


def _source() -> DataSource:
    return DataSource(
        id=uuid4(),
        name=f"stats-source-{uuid4()}",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://rss.test/feed.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
    )


def _item(
    source: DataSource,
    title: str,
    summary: str,
    metadata: dict[str, object] | None,
    collected_at: datetime | None = None,
) -> CollectedItem:
    collected = collected_at or datetime.now(timezone.utc)
    return CollectedItem(
        source_id=source.id,
        title=title,
        content_raw=f"{title} content",
        content_url=f"https://stats.test/{uuid4()}",
        summary=summary,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        metadata_extra=metadata,
        published_at=collected,
        collected_at=collected,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )


def _log(source: DataSource, status: CollectorStatus, executed_at: datetime) -> CollectorLog:
    return CollectorLog(
        source_id=source.id,
        status=status,
        items_count=3,
        error_message=None if status == CollectorStatus.SUCCESS else "failed",
        duration_ms=120,
        executed_at=executed_at,
    )


async def _seed_stats_http_data(client: TestClient) -> datetime:
    session_factory = client.app.state.session_factory
    source = _source()
    latest = datetime.now(timezone.utc) - timedelta(minutes=3)
    async with session_factory() as db:
        db.add(source)
        db.add_all(
            [
                _item(source, "AI chip demand", "Strong growth", {"sentiment": "bullish", "keywords": ["AI"]}),
                _item(source, "AI risk review", "Bearish risk", {"sentiment": "bearish", "keywords": ["AI"]}),
                _log(source, CollectorStatus.FAIL, datetime.now(timezone.utc)),
                _log(source, CollectorStatus.SUCCESS, latest),
            ]
        )
        await db.commit()
    return latest
