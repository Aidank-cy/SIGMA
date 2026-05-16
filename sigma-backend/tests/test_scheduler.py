from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.models import Base
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType
from app.scheduler.engine import add_report_jobs, load_source_jobs, scheduler
from app.scheduler.jobs import collect_from_source


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


@pytest.mark.asyncio
async def test_collect_from_source_triggers_summarizer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Collection jobs schedule summarization for newly inserted items."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    source = _source(10)
    async with session_factory() as db:
        db.add(source)
        await db.commit()

    called: list[list[object]] = []

    class FakeCollector:
        async def collect(self) -> list[dict[str, object]]:
            return [{"title": "Collected", "content": "Content", "url": "https://collect.test/1"}]

        async def validate_config(self) -> bool:
            return True

    async def fake_batch(item_ids: list[object], **_kwargs: object) -> None:
        called.append(item_ids)

    async def fake_acquire(*_args: object, **_kwargs: object) -> bool:
        return True

    async def fake_release(*_args: object, **_kwargs: object) -> None:
        return None

    monkeypatch.setattr("app.scheduler.jobs.create_collector", lambda _source: FakeCollector())
    monkeypatch.setattr("app.scheduler.jobs.acquire_lock", fake_acquire)
    monkeypatch.setattr("app.scheduler.jobs.release_lock", fake_release)
    monkeypatch.setattr("app.scheduler.jobs.batch_summarize", fake_batch)

    await collect_from_source(source.id, session_factory)
    await asyncio_sleep()

    assert len(called) == 1
    assert len(called[0]) == 1

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def test_scheduler_registers_report_jobs() -> None:
    """Scheduler registers daily, weekly, and monthly report jobs."""
    scheduler.remove_all_jobs()

    add_report_jobs()

    job_ids = {job.id for job in scheduler.get_jobs()}
    assert {"reports:daily", "reports:weekly", "reports:monthly"}.issubset(job_ids)
    scheduler.remove_all_jobs()


async def asyncio_sleep() -> None:
    import asyncio

    await asyncio.sleep(0)


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
