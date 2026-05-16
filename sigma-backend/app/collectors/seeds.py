from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


async def seed_data_sources(db: AsyncSession) -> int:
    """Insert MVP system data sources when none exist."""
    existing = await db.scalar(select(DataSource.id).limit(1))
    if existing is not None:
        return 0

    sources = [_source(**payload) for payload in SEED_SOURCES]
    db.add_all(sources)
    await db.commit()
    return len(sources)


def _source(**payload: object) -> DataSource:
    return DataSource(**payload)


SEED_SOURCES: list[dict[str, object]] = [
    {
        "name": "Yahoo Finance News",
        "source_type": SourceType.API,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.US,
        "schedule_cron": "*/30 * * * *",
        "max_execution_seconds": 120,
        "is_system": True,
        "config": {
            "base_url": "https://query1.finance.yahoo.com",
            "endpoint": "/v1/finance/search",
            "params": {"newsCount": 10, "quotesCount": 0, "q": "stock market"},
            "response_path": "news",
            "field_mapping": {
                "title": "title",
                "content": "summary",
                "content_url": "link",
                "published_at": "providerPublishTime",
            },
        },
    },
    {
        "name": "Alpha Vantage News",
        "source_type": SourceType.API,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.US,
        "schedule_cron": "*/30 * * * *",
        "max_execution_seconds": 120,
        "is_system": True,
        "config": {
            "base_url": "https://www.alphavantage.co",
            "endpoint": "/query",
            "params": {"function": "NEWS_SENTIMENT", "apikey": "$ENV:ALPHAVANTAGE_KEY"},
            "response_path": "feed",
            "field_mapping": {
                "title": "title",
                "content": "summary",
                "content_url": "url",
                "published_at": "time_published",
            },
        },
    },
    {
        "name": "FRED Releases",
        "source_type": SourceType.API,
        "category": IntelligenceCategory.MACRO,
        "market": Market.US,
        "schedule_cron": "0 * * * *",
        "max_execution_seconds": 120,
        "is_system": True,
        "config": {
            "base_url": "https://api.stlouisfed.org",
            "endpoint": "/fred/releases",
            "params": {"api_key": "$ENV:FRED_API_KEY", "file_type": "json"},
            "response_path": "releases",
            "field_mapping": {
                "title": "name",
                "content": "notes",
                "content_url": "link",
                "published_at": "realtime_start",
            },
        },
    },
    {
        "name": "NewsAPI Business",
        "source_type": SourceType.API,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.GLOBAL,
        "schedule_cron": "*/20 * * * *",
        "max_execution_seconds": 120,
        "is_system": True,
        "config": {
            "base_url": "https://newsapi.org",
            "endpoint": "/v2/top-headlines",
            "headers": {"X-Api-Key": "$ENV:NEWSAPI_KEY"},
            "params": {"category": "business", "language": "en"},
            "response_path": "articles",
            "field_mapping": {
                "title": "title",
                "content": "description",
                "content_url": "url",
                "published_at": "publishedAt",
            },
        },
    },
    {
        "name": "Finnhub Market News",
        "source_type": SourceType.API,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.US,
        "schedule_cron": "*/20 * * * *",
        "max_execution_seconds": 120,
        "is_system": True,
        "config": {
            "base_url": "https://finnhub.io",
            "endpoint": "/api/v1/news",
            "params": {"category": "general", "token": "$ENV:FINNHUB_KEY"},
            "field_mapping": {
                "title": "headline",
                "content": "summary",
                "content_url": "url",
                "published_at": "datetime",
            },
        },
    },
    {
        "name": "Reuters Markets RSS",
        "source_type": SourceType.RSS,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.GLOBAL,
        "schedule_cron": "*/30 * * * *",
        "max_execution_seconds": 90,
        "is_system": True,
        "config": {"feed_url": "https://feeds.reuters.com/reuters/businessNews", "max_entries": 20},
    },
    {
        "name": "TechCrunch RSS",
        "source_type": SourceType.RSS,
        "category": IntelligenceCategory.TECHNOLOGY,
        "market": Market.GLOBAL,
        "schedule_cron": "*/30 * * * *",
        "max_execution_seconds": 90,
        "is_system": True,
        "config": {"feed_url": "https://techcrunch.com/feed/", "max_entries": 20},
    },
    {
        "name": "Federal Reserve Announcements",
        "source_type": SourceType.SCRAPER,
        "category": IntelligenceCategory.MACRO,
        "market": Market.US,
        "schedule_cron": "0 * * * *",
        "max_execution_seconds": 120,
        "is_system": True,
        "config": {
            "target_url": "https://www.federalreserve.gov/newsevents/pressreleases.htm",
            "selectors": {
                "item_container": ".row",
                "title": "a",
                "content": "p",
                "link": "a",
                "date": "time",
            },
            "request_interval_sec": 1,
            "user_agent_rotate": True,
        },
    },
]
