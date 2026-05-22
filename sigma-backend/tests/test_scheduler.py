from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.models import Base
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, IntelligenceCategory, Market, ReportType, SourceType
from app.scheduler.engine import (
    add_cleanup_job,
    add_market_indices_job,
    add_or_update_source_job,
    add_report_jobs,
    load_source_jobs,
    remove_source_job,
    scheduler,
    start_scheduler,
    stop_scheduler,
)
from app.scheduler.jobs import _period_for, collect_from_source


@pytest.mark.asyncio
async def test_start_scheduler_starts_and_registers_core_jobs() -> None:
    """Scheduler startup registers source, cleanup, report, and market jobs."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    source = _source(99)
    async with session_factory() as db:
        db.add(source)
        await db.commit()

    scheduler.remove_all_jobs()
    try:
        await start_scheduler(session_factory)

        job_ids = {job.id for job in scheduler.get_jobs()}
        assert scheduler.running is True
        assert f"collector:{source.id}" in job_ids
        assert "cleanup_expired_items" in job_ids
        assert {"reports:daily", "reports:weekly", "reports:monthly"}.issubset(job_ids)
        assert {"market-indices:refresh", "market-candles:refresh"}.issubset(job_ids)
    finally:
        await stop_scheduler()
        scheduler.remove_all_jobs()
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


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
    assert all(job.max_instances == 1 for job in jobs)
    assert all(job.coalesce is True for job in jobs)
    assert all("cron[" in str(job.trigger) for job in jobs)

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
    async with session_factory() as db:
        items = list(await db.scalars(select(CollectedItem).where(CollectedItem.source_id == source.id)))
        logs = list(await db.scalars(select(CollectorLog).where(CollectorLog.source_id == source.id)))
    assert len(items) == 1
    assert len(logs) == 1
    assert logs[0].status == CollectorStatus.SUCCESS
    assert logs[0].items_count == 1

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def test_add_and_remove_source_job_updates_scheduler() -> None:
    """Adding and removing a source updates the scheduler job registry."""
    scheduler.remove_all_jobs()
    source = _source(20)

    add_or_update_source_job(source)

    job_id = f"collector:{source.id}"
    assert scheduler.get_job(job_id) is not None

    remove_source_job(source.id)

    assert scheduler.get_job(job_id) is None
    scheduler.remove_all_jobs()


def test_scheduler_registers_report_jobs() -> None:
    """Scheduler registers daily, weekly, and monthly report jobs."""
    scheduler.remove_all_jobs()

    add_report_jobs()

    jobs = {job.id: job for job in scheduler.get_jobs()}
    assert "cron[hour='22', minute='0']" == str(jobs["reports:daily"].trigger)
    assert "cron[day_of_week='sun', hour='22', minute='0']" == str(jobs["reports:weekly"].trigger)
    assert "cron[day='last', hour='22', minute='0']" == str(jobs["reports:monthly"].trigger)
    assert all(job.max_instances == 1 for job in jobs.values())
    assert all(job.coalesce is True for job in jobs.values())
    scheduler.remove_all_jobs()


def test_scheduler_registers_cleanup_job() -> None:
    """Scheduler registers expired item cleanup at 03:00 UTC."""
    scheduler.remove_all_jobs()

    add_cleanup_job()

    job = scheduler.get_job("cleanup_expired_items")
    assert job is not None
    assert str(job.trigger) == "cron[hour='3', minute='0']"
    assert job.max_instances == 1
    assert job.coalesce is True
    scheduler.remove_all_jobs()


def test_scheduler_registers_market_indices_job() -> None:
    """Scheduler registers near-real-time market indices refresh separately."""
    scheduler.remove_all_jobs()

    add_market_indices_job()

    assert scheduler.get_job("market-indices:refresh") is not None
    assert scheduler.get_job("market-indices:refresh").trigger.interval.total_seconds() == 15
    assert scheduler.get_job("market-candles:refresh") is not None
    assert scheduler.get_job("market-candles:refresh").trigger.interval.total_seconds() == 10
    scheduler.remove_all_jobs()

    add_report_jobs()

    job_ids = {job.id for job in scheduler.get_jobs()}
    assert {"reports:daily", "reports:weekly", "reports:monthly"}.issubset(job_ids)
    scheduler.remove_all_jobs()


def test_report_periods_match_report_type() -> None:
    """Scheduled report periods cover daily, trailing-week, and month-to-date ranges."""
    daily_start, daily_end = _period_for(ReportType.DAILY)
    weekly_start, weekly_end = _period_for(ReportType.WEEKLY)
    monthly_start, monthly_end = _period_for(ReportType.MONTHLY)

    assert daily_start == daily_end
    assert weekly_end == daily_end
    assert (weekly_end - weekly_start).days == 6
    assert monthly_end == daily_end
    assert monthly_start == daily_end.replace(day=1)


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
