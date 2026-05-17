from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes.stats import get_sentiment_stats, get_trending_keywords
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


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

    response = await get_sentiment_stats(db_session)

    assert response.bullish_pct == 33


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

    response = await get_trending_keywords(db_session)

    assert response.items[0].keyword == "chips"
    assert response.items[0].count == 2


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
) -> CollectedItem:
    return CollectedItem(
        source_id=source.id,
        title=title,
        content_raw=f"{title} content",
        content_url=f"https://stats.test/{uuid4()}",
        summary=summary,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        metadata_extra=metadata,
        published_at=datetime.now(timezone.utc),
        collected_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
