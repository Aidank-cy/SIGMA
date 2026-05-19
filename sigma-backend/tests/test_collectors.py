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
async def test_api_collector_sends_default_user_agent() -> None:
    """API collector identifies itself to public APIs."""
    seen_user_agent = ""

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_user_agent
        seen_user_agent = request.headers.get("User-Agent", "")
        return httpx.Response(200, json={"items": [{"headline": "First", "body": "One"}]})

    source = _source(
        SourceType.API,
        {
            "base_url": "https://api.test",
            "endpoint": "/items",
            "response_path": "items",
            "field_mapping": {"title": "headline", "content": "body"},
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        await APICollector(source, client).collect()

    assert seen_user_agent == "SIGMACollector/1.0"


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
async def test_rss_collector_sends_default_user_agent() -> None:
    """RSS collector identifies itself to feeds that reject empty clients."""
    seen_user_agent = ""

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_user_agent
        seen_user_agent = request.headers.get("User-Agent", "")
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
        await RSSCollector(source, client).collect()

    assert seen_user_agent == "SIGMACollector/1.0"


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


def test_normalizer_parses_layer_five_datetime_formats() -> None:
    """Normalizer accepts source date formats required by Layer 5."""
    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml"})
    raw_items = [
        {"title": "ISO", "content": "Content", "published_at": "2026-05-19T10:30:00Z"},
        {"title": "Unix", "content": "Content", "published_at": 1_779_186_600},
        {"title": "Human", "content": "Content", "published_at": "May 19, 2026"},
        {"title": "Alpha", "content": "Content", "published_at": "20260519T103000"},
    ]

    normalized = normalize_items(source, raw_items)

    assert [item.title for item in normalized] == ["ISO", "Unix", "Human", "Alpha"]
    assert normalized[0].published_at.isoformat() == "2026-05-19T10:30:00+00:00"
    assert normalized[1].published_at.isoformat() == "2026-05-19T10:30:00+00:00"
    assert normalized[2].published_at.isoformat() == "2026-05-19T00:00:00+00:00"
    assert normalized[3].published_at.isoformat() == "2026-05-19T10:30:00+00:00"


@pytest.mark.asyncio
async def test_dedup_filters_existing_title_for_source(db_session: AsyncSession) -> None:
    """Dedup removes same-source title repeats even when URL differs."""
    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml"})
    source.id = uuid4()
    db_session.add(source)
    existing = CollectedItem(
        source_id=source.id,
        title="Repeated headline",
        content_raw="Existing content",
        content_url="https://existing.test/item",
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(existing)
    await db_session.commit()

    normalized = normalize_items(
        source,
        [
            {
                "title": "Repeated headline",
                "content": "New content",
                "content_url": "https://new-url.test/item",
                "published_at": "2026-05-19T10:30:00Z",
            },
            {"title": "Fresh headline", "content": "Fresh content", "content_url": "https://fresh.test/item"},
        ],
    )

    filtered = await filter_new_items(db_session, normalized)

    assert [item.title for item in filtered] == ["Fresh headline"]


@pytest.mark.asyncio
async def test_dedup_filters_batch_title_repeats_for_source(db_session: AsyncSession) -> None:
    """Dedup keeps only the first same-source title in a collection batch."""
    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml"})
    source.id = uuid4()
    db_session.add(source)
    await db_session.commit()

    normalized = normalize_items(
        source,
        [
            {"title": "Batch repeat", "content": "First", "content_url": "https://batch.test/1"},
            {"title": "Batch repeat", "content": "Second", "content_url": "https://batch.test/2"},
            {"title": "Batch fresh", "content": "Third", "content_url": "https://batch.test/3"},
        ],
    )

    filtered = await filter_new_items(db_session, normalized)

    assert [item.title for item in filtered] == ["Batch repeat", "Batch fresh"]


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
