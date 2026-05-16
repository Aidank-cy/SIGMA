from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.models import Base
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType
from app.scheduler.engine import load_source_jobs, scheduler


@pytest.mark.asyncio
async def test_scheduler_registers_active_source_jobs() -> None:
    """Scheduler registers one job per active source plus cleanup separately."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with session_factory() as db:
        db.add_all([_source(index) for index in range(3)])
        await db.commit()

    scheduler.remove_all_jobs()
    await load_source_jobs(session_factory)

    jobs = scheduler.get_jobs()
    assert len(jobs) == 3

    scheduler.remove_all_jobs()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def _source(index: int) -> DataSource:
    return DataSource(
        id=uuid4(),
        name=f"source-{index}",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": f"https://rss.test/{index}.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
        is_active=True,
    )
