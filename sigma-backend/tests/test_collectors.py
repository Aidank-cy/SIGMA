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
async def test_api_collector_accepts_user_created_config_aliases() -> None:
    """API collector accepts the Sync wizard endpoint and items_path fields."""
    seen_url = ""

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_url
        seen_url = str(request.url)
        return httpx.Response(
            200,
            json={
                "payload": {
                    "items": [
                        {
                            "title": "Alias item",
                            "description": "Alias description",
                            "link": "https://api.test/alias",
                            "pubDate": "2026-05-22T12:00:00Z",
                        }
                    ]
                }
            },
        )

    source = _source(
        SourceType.API,
        {
            "endpoint": "https://api.test/user-items",
            "items_path": "payload.items",
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        collector = APICollector(source, client)
        assert await collector.validate_config()
        items = await collector.collect()

    assert seen_url == "https://api.test/user-items"
    assert items == [
        {
            "title": "Alias item",
            "content": "Alias description",
            "content_url": "https://api.test/alias",
            "published_at": "2026-05-22T12:00:00+00:00",
        }
    ]


@pytest.mark.asyncio
async def test_api_collector_preserves_endpoint_query_without_params() -> None:
    """API collector preserves query strings on full endpoint URLs."""
    seen_url = ""

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_url
        seen_url = str(request.url)
        return httpx.Response(200, json={"results": [{"title": "Query item", "description": "Body"}]})

    source = _source(
        SourceType.API,
        {
            "endpoint": "https://newsdata.test/api/latest?apikey=pub_test&language=en",
            "items_path": "results",
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await APICollector(source, client).collect()

    assert seen_url == "https://newsdata.test/api/latest?apikey=pub_test&language=en"
    assert items[0]["title"] == "Query item"


@pytest.mark.asyncio
async def test_api_collector_retries_rate_limited_requests() -> None:
    """API collector retries 429 responses with Retry-After backoff."""
    attempts = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"items": [{"title": "Recovered item", "description": "Recovered body"}]})

    source = _source(
        SourceType.API,
        {
            "endpoint": "https://api.test/rate-limited",
            "response_path": "items",
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await APICollector(source, client).collect()

    assert attempts == 2
    assert items[0]["title"] == "Recovered item"


@pytest.mark.asyncio
async def test_api_collector_unwraps_nested_results_and_cleans_fields() -> None:
    """API collector unwraps nested payloads and normalizes mapped values."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "payload": {
                    "data": {
                        "results": [
                            {
                                "headline": "<b>Nested &amp; item</b>",
                                "body": None,
                                "links": [{"url": "https://api.test/nested"}],
                                "providerPublishTime": 1_779_186_600_000,
                            }
                        ]
                    }
                }
            },
        )

    source = _source(
        SourceType.API,
        {
            "base_url": "https://api.test",
            "endpoint": "/nested",
            "response_path": "payload",
            "field_mapping": {
                "title": "headline",
                "content": "body",
                "content_url": "links.0.url",
                "published_at": "providerPublishTime",
            },
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await APICollector(source, client).collect()

    assert items == [
        {
            "title": "Nested & item",
            "content": "Nested & item",
            "content_url": "https://api.test/nested",
            "published_at": "2026-05-19T10:30:00+00:00",
        }
    ]


@pytest.mark.asyncio
async def test_api_collector_enriches_repeated_title_content() -> None:
    """API collector enriches sparse metadata items when body text falls back to the title."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "releases": [
                    {
                        "name": "Federal Recovery Programs and BEA Statistics",
                        "notes": None,
                        "press_release": True,
                        "link": "https://fred.stlouisfed.org/release?rid=331",
                        "realtime_start": "2026-05-22",
                        "realtime_end": "2026-05-22",
                    }
                ]
            },
        )

    source = _source(
        SourceType.API,
        {
            "base_url": "https://api.test",
            "endpoint": "/fred/releases",
            "response_path": "releases",
            "field_mapping": {
                "title": "name",
                "content": "notes",
                "content_url": "link",
                "published_at": "realtime_start",
            },
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await APICollector(source, client).collect()

    assert items[0]["content"] == (
        "Federal Recovery Programs and BEA Statistics. "
        "Release date: 2026-05-22. "
        "This release includes a press release. "
        "Source: https://fred.stlouisfed.org/release?rid=331"
    )


@pytest.mark.asyncio
async def test_api_collector_filters_short_content_and_caps_entries() -> None:
    """API collector skips sparse metadata rows and stops at max_entries."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "release_dates": [
                    {"release_id": 1, "release_name": "CPI", "date": "2026-05-22"},
                    {
                        "release_id": 2,
                        "release_name": "Consumer Price Index",
                        "date": "2026-05-22",
                    },
                    {
                        "release_id": 3,
                        "release_name": "Employment Situation",
                        "date": "2026-05-21",
                    },
                ]
            },
        )

    source = _source(
        SourceType.API,
        {
            "base_url": "https://api.test",
            "endpoint": "/fred/releases/dates",
            "response_path": "release_dates",
            "max_entries": 1,
            "min_content_length": 50,
            "min_title_length": 12,
            "metadata_fields": ["release_id"],
            "field_mapping": {
                "title": "release_name",
                "content": "release_name",
                "published_at": "date",
            },
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await APICollector(source, client).collect()

    assert len(items) == 1
    assert items[0]["title"] == "Consumer Price Index"
    assert items[0]["content"] == (
        "Consumer Price Index. "
        "Release date: 2026-05-22. "
        "Source: https://fred.stlouisfed.org/release?rid=2"
    )
    assert items[0]["content_url"] == "https://fred.stlouisfed.org/release?rid=2"


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
async def test_rss_collection_normalizes_and_persists_item_shape(db_session: AsyncSession) -> None:
    """RSS collection produces persisted items with source metadata and collection time."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="""<?xml version="1.0"?>
            <rss version="2.0"><channel><item>
            <title>AI Market Brief</title><description>AI stock movement summary</description>
            <link>https://rss.test/ai-market-brief</link>
            <pubDate>Sat, 16 May 2026 03:00:00 GMT</pubDate>
            </item></channel></rss>""",
        )

    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml", "max_entries": 5})
    db_session.add(source)
    await db_session.flush()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        raw_items = await RSSCollector(source, client).collect()

    normalized = normalize_items(source, raw_items)
    persisted = CollectedItem(**normalized[0].model_dump())
    db_session.add(persisted)
    await db_session.commit()
    await db_session.refresh(persisted)

    assert persisted.title == "AI Market Brief"
    assert persisted.content_raw == "AI stock movement summary"
    assert persisted.content_url == "https://rss.test/ai-market-brief"
    assert persisted.category == IntelligenceCategory.FINANCE
    assert persisted.market == Market.US
    assert persisted.collected_at is not None


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
async def test_rss_collector_uses_atom_content_and_strips_html() -> None:
    """RSS collector reads Atom content payloads and strips markup."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="""<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <entry>
                <title>Atom &amp; Brief</title>
                <link href="https://atom.test/item" />
                <updated>2026-05-19T10:30:00Z</updated>
                <content type="html">&lt;p&gt;Atom &amp;amp; content&lt;/p&gt;</content>
              </entry>
            </feed>""",
        )

    source = _source(SourceType.RSS, {"feed_url": "https://atom.test/feed.xml", "max_entries": 5})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await RSSCollector(source, client).collect()

    assert items[0]["title"] == "Atom & Brief"
    assert items[0]["content"] == "Atom & content"
    assert items[0]["content_url"] == "https://atom.test/item"


@pytest.mark.asyncio
async def test_scraper_collector_extracts_html_items() -> None:
    """Scraper collector extracts items with CSS selectors."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="""<html><article class="item">
            <a class="title" href="/news/1">Fed Update</a>
            <p class="body">Policy signal for market supervision conditions</p><time>2026-05-16T03:00:00Z</time>
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
async def test_scraper_collector_filters_short_items_and_caps_entries() -> None:
    """Scraper collector skips structural fragments and honors max_entries."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="""<html>
            <div class="entry"><a href="/noise">Fed</a><p>One</p><time>5/22/2026</time></div>
            <div class="entry"><a href="/news/1">Federal Reserve Board announces supervisory policy update</a><p>Other Announcements</p><time>5/22/2026</time></div>
            <div class="entry"><a href="/news/2">Federal Reserve Board releases banking application order</a><p>Orders on Banking Applications</p><time>5/21/2026</time></div>
            </html>""",
        )

    source = _source(
        SourceType.SCRAPER,
        {
            "target_url": "https://fed.test/releases",
            "selectors": {
                "item_container": ".entry",
                "title": "a",
                "content": "p",
                "link": "a",
                "date": "time",
            },
            "max_entries": 1,
            "min_content_length": 30,
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await ScraperCollector(source, client).collect()

    assert len(items) == 1
    assert items[0]["title"] == "Federal Reserve Board announces supervisory policy update"
    assert items[0]["published_at"] == "2026-05-22T00:00:00+00:00"


@pytest.mark.asyncio
async def test_scraper_collector_accepts_user_created_config_aliases() -> None:
    """Scraper collector accepts the Sync wizard url and item_selector fields."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://site.test/news"
        return httpx.Response(
            200,
            text="""<html><article class="item">
            <a href="/news/alias">Alias scraper item</a>
            <p>Readable market article summary with enough detail</p>
            </article></html>""",
        )

    source = _source(
        SourceType.SCRAPER,
        {
            "url": "https://site.test/news",
            "item_selector": ".item",
            "min_content_length": 10,
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        collector = ScraperCollector(source, client)
        assert await collector.validate_config()
        items = await collector.collect()

    assert items[0]["title"] == "Alias scraper item"
    assert items[0]["content"] == "Readable market article summary with enough detail"
    assert items[0]["content_url"] == "https://site.test/news/alias"


@pytest.mark.asyncio
async def test_scraper_collector_cleans_title_noise_and_expands_duplicate_content() -> None:
    """Scraper collector removes title counters and avoids title-only content."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="""<html><article class="item">
            <a class="title" href="/news/1">Global arms sale <span>13</span></a>
            <p class="summary">Global arms sale</p>
            <p class="summary">Diplomatic context with enough detail for summarization.</p>
            </article></html>""",
        )

    source = _source(
        SourceType.SCRAPER,
        {
            "target_url": "https://ap.test/world",
            "selectors": {
                "item_container": ".item",
                "title": ".title",
                "content": ".summary",
                "link": ".title",
            },
            "min_content_length": 10,
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await ScraperCollector(source, client).collect()

    assert items[0]["title"] == "Global arms sale"
    assert items[0]["content"] == "Diplomatic context with enough detail for summarization."


@pytest.mark.asyncio
async def test_scraper_collector_can_follow_links_for_article_body() -> None:
    """Scraper collector can fetch linked article bodies when cards only repeat titles."""

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "https://site.test/news/1":
            return httpx.Response(
                200,
                text="""<html><article>
                <p>Full article paragraph with policy details and market impact.</p>
                <p>Second paragraph adds enough body text for summarization.</p>
                </article></html>""",
            )
        return httpx.Response(
            200,
            text="""<html><article class="item">
            <a class="title" href="/news/1">Policy update</a>
            <p>Policy update</p>
            </article></html>""",
        )

    source = _source(
        SourceType.SCRAPER,
        {
            "target_url": "https://site.test/list",
            "selectors": {
                "item_container": ".item",
                "title": ".title",
                "content": "p",
                "link": ".title",
            },
            "follow_link": True,
            "min_content_length": 10,
        },
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        items = await ScraperCollector(source, client).collect()

    assert items[0]["content"] == (
        "Full article paragraph with policy details and market impact. "
        "Second paragraph adds enough body text for summarization."
    )


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
        {"title": "DateOnly", "content": "Content", "published_at": "2026-05-19"},
        {"title": "Slash", "content": "Content", "published_at": "2026/05/19 10:30:00"},
        {"title": "DayMonth", "content": "Content", "published_at": "19 May 2026"},
        {"title": "Millis", "content": "Content", "published_at": 1_779_186_600_000},
        {"title": "Nanos", "content": "Content", "published_at": 1_779_186_600_000_000_000},
    ]

    normalized = normalize_items(source, raw_items)

    assert [item.title for item in normalized] == ["ISO", "Unix", "Human", "Alpha", "DateOnly", "Slash", "DayMonth", "Millis", "Nanos"]
    assert normalized[0].published_at.isoformat() == "2026-05-19T10:30:00+00:00"
    assert normalized[1].published_at.isoformat() == "2026-05-19T10:30:00+00:00"
    assert normalized[2].published_at.isoformat() == "2026-05-19T00:00:00+00:00"
    assert normalized[3].published_at.isoformat() == "2026-05-19T10:30:00+00:00"
    assert normalized[4].published_at.isoformat() == "2026-05-19T00:00:00+00:00"
    assert normalized[5].published_at.isoformat() == "2026-05-19T10:30:00+00:00"
    assert normalized[6].published_at.isoformat() == "2026-05-19T00:00:00+00:00"
    assert normalized[7].published_at.isoformat() == "2026-05-19T10:30:00+00:00"
    assert normalized[8].published_at.isoformat() == "2026-05-19T10:30:00+00:00"


def test_normalizer_cleans_title_and_content_text() -> None:
    """Normalizer strips markup and entities from text fields."""
    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml"})

    normalized = normalize_items(
        source,
        [
            {
                "title": "<b>Clean &amp; Title</b>",
                "content": "<p>Body&nbsp;text</p>",
                "published_at": "2026-05-19T10:30:00Z",
            }
        ],
    )

    assert normalized[0].title == "Clean & Title"
    assert normalized[0].content_raw == "Body text"


def test_normalizer_skips_articles_older_than_thirty_days() -> None:
    """Normalizer excludes stale source content before persistence."""
    source = _source(SourceType.RSS, {"feed_url": "https://rss.test/feed.xml"})
    now = datetime.now(timezone.utc)

    normalized = normalize_items(
        source,
        [
            {
                "title": "Old article",
                "content": "Stale content",
                "published_at": (now - timedelta(days=31)).isoformat(),
            },
            {
                "title": "Recent article",
                "content": "Fresh content",
                "published_at": (now - timedelta(days=2)).isoformat(),
            },
        ],
    )

    assert [item.title for item in normalized] == ["Recent article"]


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
