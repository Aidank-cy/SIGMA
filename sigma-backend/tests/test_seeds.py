import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.collectors.seeds import seed_data_sources
from app.main import create_app
from app.models import Base
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


async def test_seed_data_sources_creates_seven_sources(db_session: AsyncSession) -> None:
    """Seed helper inserts seven Layer 5 system sources into an empty table."""
    created = await seed_data_sources(db_session)
    total = await db_session.scalar(select(func.count()).select_from(DataSource))

    assert created == 7
    assert total == 7


def test_app_startup_seeds_data_sources(monkeypatch) -> None:
    """FastAPI startup creates seed data sources before serving requests."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def create_tables() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def count_sources() -> int:
        async with session_factory() as db:
            return int(await db.scalar(select(func.count()).select_from(DataSource)) or 0)

    async def drop_tables() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    async def fake_start_scheduler(*_args: object, **_kwargs: object) -> None:
        return None

    async def fake_stop_scheduler() -> None:
        return None

    monkeypatch.setattr("app.main.AsyncSessionLocal", session_factory)
    monkeypatch.setattr("app.main.start_scheduler", fake_start_scheduler)
    monkeypatch.setattr("app.main.stop_scheduler", fake_stop_scheduler)

    asyncio.run(create_tables())
    try:
        app = create_app(enable_scheduler=True)
        with TestClient(app) as client:
            assert client.get("/api/v1/health").status_code == 200
        assert asyncio.run(count_sources()) == 7
    finally:
        asyncio.run(drop_tables())


async def test_seed_data_sources_replaces_obsolete_reuters_feed(db_session: AsyncSession) -> None:
    """Seed helper updates the removed Reuters RSS feed in existing databases."""
    db_session.add(
        _system_source(
            "Reuters Markets RSS", {"feed_url": "https://feeds.reuters.com/reuters/businessNews"}
        )
    )
    await db_session.commit()

    created = await seed_data_sources(db_session)
    source = await db_session.scalar(
        select(DataSource).where(DataSource.name == "Dow Jones Markets RSS")
    )

    assert created == 0
    assert source is not None
    assert source.config["feed_url"] == "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"


async def test_seed_data_sources_replaces_unreachable_newsapi_source(
    db_session: AsyncSession,
) -> None:
    """Seed helper swaps Docker-unreachable NewsAPI for a stable business RSS source."""
    db_session.add(_system_source("NewsAPI Business", {"base_url": "https://newsapi.org"}))
    await db_session.commit()

    created = await seed_data_sources(db_session)
    source = await db_session.scalar(
        select(DataSource).where(DataSource.name == "BBC Business RSS")
    )

    assert created == 0
    assert source is not None
    assert source.source_type == SourceType.RSS
    assert source.config["feed_url"] == "https://feeds.bbci.co.uk/news/business/rss.xml"


async def test_seed_data_sources_updates_yahoo_mapping(db_session: AsyncSession) -> None:
    """Seed helper keeps existing Yahoo sources aligned with current response keys."""
    db_session.add(
        _system_source(
            "Yahoo Finance News",
            {
                "base_url": "https://query1.finance.yahoo.com",
                "field_mapping": {"title": "title", "content": "summary"},
            },
            source_type=SourceType.API,
        )
    )
    await db_session.commit()

    created = await seed_data_sources(db_session)
    source = await db_session.scalar(
        select(DataSource).where(DataSource.name == "Yahoo Finance News")
    )

    assert created == 0
    assert source is not None
    assert source.config["field_mapping"]["content"] == "title"
    assert source.config["headers"]["User-Agent"] == "SIGMACollector/1.0"


async def test_seed_data_sources_removes_layer_six_sentiment_source(
    db_session: AsyncSession,
) -> None:
    """Seed sync deletes the old Alpha Vantage NEWS_SENTIMENT source."""
    db_session.add(
        _system_source(
            "Alpha Vantage News", {"function": "NEWS_SENTIMENT"}, source_type=SourceType.API
        )
    )
    await db_session.commit()

    created = await seed_data_sources(db_session)
    source = await db_session.scalar(
        select(DataSource).where(DataSource.name == "Alpha Vantage News")
    )

    assert created == 7
    assert source is None


def _system_source(
    name: str,
    config: dict[str, object],
    *,
    source_type: SourceType = SourceType.RSS,
) -> DataSource:
    return DataSource(
        name=name,
        source_type=source_type,
        category=IntelligenceCategory.FINANCE,
        market=Market.GLOBAL,
        schedule_cron="*/30 * * * *",
        max_execution_seconds=90,
        is_system=True,
        config=config,
    )
