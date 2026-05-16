from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.api_collector import APICollector
from app.collectors.dedup import filter_new_items
from app.collectors.normalizer import normalize_items
from app.collectors.rss_collector import RSSCollector
from app.collectors.scraper_collector import ScraperCollector
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


@pytest.mark.asyncio
async def test_api_collector_maps_paginated_items() -> None:
    """API collector maps fields across paginated responses."""

    def handler(request: httpx.Request) -> httpx.Response:
        page = request.url.params.get("page")
        payload = {
            "1": {"items": [{"headline": "First", "body": "One", "url": "https://a.test/1"}]},
            "2": {"items": [{"headline": "Second", "body": "Two", "url": "https://a.test/2"}]},
        }[page]
        return httpx.Response(200, json=payload)

    source = _source(
        SourceType.API,
        {
            "base_url": "https://api.test",
            "endpoint": "/items",
            "response_path": "items",
            "pagination": {"param": "page", "max_pages": 2},
            "field_mapping": {"title": "headline", "content": "body", "content_url": "url"},
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await APICollector(source, client).collect()

    assert [item["title"] for item in items] == ["First", "Second"]
    assert items[1]["content_url"] == "https://a.test/2"


@pytest.mark.asyncio
async def test_rss_collector_parses_feed_entries() -> None:
    """RSS collector parses feed XML into raw items."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="""<?xml version="1.0"?>
            <rss version="2.0"><channel><item>
            <title>Market Brief</title><description>Summary text</description>
            <link>https://rss.test/item</link><pubDate>Sat, 16 May 2026 03:00:00 GMT</pubDate>
            </item></channel></rss>""",
        )

    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml", "max_entries": 5})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await RSSCollector(source, client).collect()

    assert items[0]["title"] == "Market Brief"
    assert items[0]["content_url"] == "https://rss.test/item"


@pytest.mark.asyncio
async def test_scraper_collector_extracts_html_items() -> None:
    """Scraper collector extracts items with CSS selectors."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="""<html><article class="item">
            <a class="title" href="/news/1">Fed Update</a>
            <p class="body">Policy signal</p><time>2026-05-16T03:00:00Z</time>
            </article></html>""",
        )

    source = _source(
        SourceType.SCRAPER,
        {
            "target_url": "https://fed.test/releases",
            "selectors": {
                "item_container": ".item",
                "title": ".title",
                "content": ".body",
                "link": ".title",
                "date": "time",
            },
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await ScraperCollector(source, client).collect()

    assert items[0]["title"] == "Fed Update"
    assert items[0]["content_url"] == "https://fed.test/news/1"


@pytest.mark.asyncio
async def test_dedup_filters_existing_url(db_session: AsyncSession) -> None:
    """Dedup removes items already persisted by content URL."""
    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml"})
    source.id = uuid4()
    db_session.add(source)
    existing = CollectedItem(
        source_id=source.id,
        title="Existing",
        content_raw="Existing content",
        content_url="https://dup.test/item",
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(existing)
    await db_session.commit()

    normalized = normalize_items(
        source,
        [
            {
                "title": "Existing",
                "content": "Existing content",
                "content_url": "https://dup.test/item",
                "published_at": existing.published_at.isoformat(),
            },
            {"title": "New", "content": "New content", "content_url": "https://new.test/item"},
        ],
    )

    filtered = await filter_new_items(db_session, normalized)

    assert len(filtered) == 1
    assert filtered[0].title == "New"


def _source(source_type: SourceType, config: dict[str, object]) -> DataSource:
    return DataSource(
        id=uuid4(),
        name=f"{source_type.value}-{uuid4()}",
        source_type=source_type,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config=config,
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
    )
