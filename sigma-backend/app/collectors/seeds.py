from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.base import DEFAULT_USER_AGENT
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


async def seed_data_sources(db: AsyncSession) -> int:
    """Insert MVP system data sources when none exist."""
    await _sync_existing_seed_sources(db)
    existing = await db.scalar(select(DataSource.id).limit(1))
    if existing is not None:
        return 0

    sources = [_source(**payload) for payload in SEED_SOURCES]
    db.add_all(sources)
    await db.commit()
    return len(sources)


def _source(**payload: object) -> DataSource:
    return DataSource(**payload)


async def _sync_existing_seed_sources(db: AsyncSession) -> None:
    seed_sources = {str(seed["name"]): seed for seed in SEED_SOURCES}
    sources = await db.scalars(select(DataSource).where(DataSource.is_system.is_(True)))
    for source in sources:
        seed_name = OBSOLETE_SEED_SOURCE_NAMES.get(source.name, source.name)
        if source.name not in OBSOLETE_SEED_SOURCE_NAMES and seed_name not in SYNC_SEED_SOURCE_NAMES:
            continue
        replacement = seed_sources.get(seed_name)
        if replacement is None:
            continue
        source.name = str(replacement["name"])
        source.source_type = replacement["source_type"]  # type: ignore[assignment]
        source.category = replacement["category"]  # type: ignore[assignment]
        source.market = replacement["market"]  # type: ignore[assignment]
        source.schedule_cron = str(replacement["schedule_cron"])
        source.max_execution_seconds = int(replacement["max_execution_seconds"])
        source.is_system = bool(replacement["is_system"])
        source.config = dict(replacement["config"])  # type: ignore[arg-type]
    await db.commit()


OBSOLETE_SEED_SOURCE_NAMES = {
    "Reuters Markets RSS": "Dow Jones Markets RSS",
    "CNBC Business RSS": "Dow Jones Markets RSS",
    "NewsAPI Business": "BBC Business RSS",
}
SYNC_SEED_SOURCE_NAMES = {"Yahoo Finance News", "BBC Business RSS", "Dow Jones Markets RSS"}


SEED_SOURCES: list[dict[str, object]] = [
    {
        "name": "Yahoo Finance News",
        "source_type": SourceType.API,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.US,
        "schedule_cron": "0 * * * *",
        "max_execution_seconds": 120,
        "is_system": True,
        "config": {
            "base_url": "https://query1.finance.yahoo.com",
            "endpoint": "/v1/finance/search",
            "headers": {"User-Agent": DEFAULT_USER_AGENT},
            "params": {"newsCount": 5, "quotesCount": 0, "q": "stock market"},
            "response_path": "news",
            "field_mapping": {
                "title": "title",
                "content": "title",
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
        "name": "BBC Business RSS",
        "source_type": SourceType.RSS,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.GLOBAL,
        "schedule_cron": "*/30 * * * *",
        "max_execution_seconds": 90,
        "is_system": True,
        "config": {"feed_url": "https://feeds.bbci.co.uk/news/business/rss.xml", "max_entries": 20},
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
        "name": "Dow Jones Markets RSS",
        "source_type": SourceType.RSS,
        "category": IntelligenceCategory.FINANCE,
        "market": Market.GLOBAL,
        "schedule_cron": "*/30 * * * *",
        "max_execution_seconds": 90,
        "is_system": True,
        "config": {"feed_url": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", "max_entries": 20},
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
