from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.collectors.normalizer import normalize_items
from app.models import Base
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, IntelligenceCategory, Market, ReportType, SourceType
from app.models.report import Report
from app.models.user import User
from app.models.user_report_config import UserReportConfig
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
from app.scheduler.jobs import (
    _config_frequencies_for,
    _config_matches_report_type,
    _insert_new_items,
    _period_for,
    collect_from_source,
    generate_scheduled_reports,
)


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
        assert {
            "reports:daily_morning",
            "reports:daily_afternoon",
            "reports:weekly",
            "reports:monthly",
        }.issubset(job_ids)
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
        items = list(
            await db.scalars(select(CollectedItem).where(CollectedItem.source_id == source.id))
        )
        logs = list(
            await db.scalars(select(CollectorLog).where(CollectorLog.source_id == source.id))
        )
    assert len(items) == 1
    assert len(logs) == 1
    assert logs[0].status == CollectorStatus.SUCCESS
    assert logs[0].items_count == 1

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_insert_new_items_skips_duplicate_content_url() -> None:
    """Collector persistence skips URL conflicts instead of failing the run."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    source = _source(11)
    now = datetime.now(UTC)
    async with session_factory() as db:
        db.add(source)
        db.add(
            CollectedItem(
                source_id=source.id,
                title="Existing",
                content_raw="Existing content",
                content_url="https://duplicate.test/item",
                category=IntelligenceCategory.FINANCE,
                market=Market.US,
                published_at=now,
                expires_at=now + timedelta(days=30),
            )
        )
        await db.commit()

        normalized = normalize_items(
            source,
            [
                {
                    "title": "Overlap",
                    "content": "Overlapping content",
                    "content_url": "https://duplicate.test/item",
                    "published_at": now.isoformat(),
                },
                {
                    "title": "Fresh",
                    "content": "Fresh content",
                    "content_url": "https://fresh.test/item",
                    "published_at": now.isoformat(),
                },
            ],
        )
        inserted_ids = await _insert_new_items(db, normalized)
        await db.commit()
        items = list(await db.scalars(select(CollectedItem).order_by(CollectedItem.title)))

    assert len(inserted_ids) == 1
    assert [item.title for item in items] == ["Existing", "Fresh"]

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def test_add_and_remove_source_job_updates_scheduler() -> None:
    """Adding and removing a source updates the scheduler job registry."""
    scheduler.remove_all_jobs()
    source = _source(20)

    add_or_update_source_job(source)

    job_id = f"collector:{source.id}"
    job = scheduler.get_job(job_id)
    assert job is not None
    assert 0 <= job.trigger.jitter <= 30

    remove_source_job(source.id)

    assert scheduler.get_job(job_id) is None
    scheduler.remove_all_jobs()


def test_scheduler_registers_report_jobs() -> None:
    """Scheduler registers Beijing-time daily, weekly, and monthly report jobs."""
    scheduler.remove_all_jobs()

    add_report_jobs()

    jobs = {job.id: job for job in scheduler.get_jobs()}
    assert (
        str(jobs["reports:daily_morning"].trigger)
        == "cron[day_of_week='mon-fri', hour='1', minute='21']"
    )
    assert (
        str(jobs["reports:daily_afternoon"].trigger)
        == "cron[day_of_week='mon-fri', hour='9', minute='31']"
    )
    assert str(jobs["reports:weekly"].trigger) == "cron[day_of_week='fri', hour='9', minute='45']"
    assert str(jobs["reports:monthly"].trigger) == "cron[day='1', hour='4', minute='0']"
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
    assert {
        "reports:daily_morning",
        "reports:daily_afternoon",
        "reports:weekly",
        "reports:monthly",
    }.issubset(job_ids)
    scheduler.remove_all_jobs()


def test_report_periods_match_report_type() -> None:
    """Scheduled report periods use exact Beijing-time filter windows."""
    beijing = ZoneInfo("Asia/Shanghai")
    now = datetime(2026, 5, 22, 9, 45, tzinfo=UTC)
    morning_start, morning_end = _period_for(ReportType.DAILY_MORNING, now)
    afternoon_start, afternoon_end = _period_for(ReportType.DAILY_AFTERNOON, now)
    weekly_start, weekly_end = _period_for(ReportType.WEEKLY, now)
    monthly_start, monthly_end = _period_for(ReportType.MONTHLY, now)

    assert morning_start == datetime(2026, 5, 21, 17, 30, 1, tzinfo=beijing)
    assert morning_end == datetime(2026, 5, 22, 9, 20, tzinfo=beijing)
    assert afternoon_start == datetime(2026, 5, 22, 9, 20, 1, tzinfo=beijing)
    assert afternoon_end == datetime(2026, 5, 22, 17, 30, tzinfo=beijing)
    assert weekly_start == datetime(2026, 5, 15, 17, 45, 1, tzinfo=beijing)
    assert weekly_end == datetime(2026, 5, 22, 17, 44, tzinfo=beijing)
    assert monthly_start == datetime(2026, 4, 1, 0, 0, tzinfo=beijing)
    assert monthly_end == datetime(2026, 4, 30, 23, 59, 59, tzinfo=beijing)


def test_report_periods_use_configured_time_ranges() -> None:
    """Weekly and monthly report periods use per-user configured ranges."""
    beijing = ZoneInfo("Asia/Shanghai")
    now = datetime(2026, 5, 22, 9, 45, tzinfo=UTC)

    weekly_start, weekly_end = _period_for(
        ReportType.WEEKLY,
        now,
        {
            "weekly": {
                "start_day_offset": 10,
                "end_day_offset": 1,
                "start_time": "08:30",
                "end_time": "16:15",
            }
        },
    )
    monthly_start, monthly_end = _period_for(
        ReportType.MONTHLY,
        now,
        {"monthly": {"start_day_of_month": 3, "end_day_of_month": 18}},
    )
    short_month_start, short_month_end = _period_for(
        ReportType.MONTHLY,
        datetime(2026, 3, 5, 9, 45, tzinfo=UTC),
        {"monthly": {"start_day_of_month": 1, "end_day_of_month": 31}},
    )

    assert weekly_start == datetime(2026, 5, 12, 8, 30, tzinfo=beijing)
    assert weekly_end == datetime(2026, 5, 21, 16, 15, tzinfo=beijing)
    assert monthly_start == datetime(2026, 4, 3, 0, 0, tzinfo=beijing)
    assert monthly_end == datetime(2026, 4, 18, 23, 59, 59, tzinfo=beijing)
    assert short_month_start == datetime(2026, 2, 1, 0, 0, tzinfo=beijing)
    assert short_month_end == datetime(2026, 2, 28, 23, 59, 59, tzinfo=beijing)


def test_daily_report_frequency_matching_uses_exact_base_mapping() -> None:
    """Frequency expansion happens in config matching, not the base mapping."""
    assert _config_frequencies_for(ReportType.DAILY_MORNING) == (ReportType.DAILY_MORNING,)
    assert _config_frequencies_for(ReportType.DAILY_AFTERNOON) == (ReportType.DAILY_AFTERNOON,)
    assert _config_frequencies_for(ReportType.DAILY) == (ReportType.DAILY,)


def test_report_frequency_list_matching_deduplicates_daily_overlap() -> None:
    """Split daily configs match from the JSON frequency list without duplicate rows."""
    config = UserReportConfig(
        user_id=uuid4(),
        report_frequency=ReportType.DAILY,
        report_frequencies=["daily", "daily_morning"],
    )

    assert _config_matches_report_type(config, ReportType.DAILY_MORNING) is True
    assert _config_matches_report_type(config, ReportType.DAILY_AFTERNOON) is True
    assert _config_matches_report_type(config, ReportType.DAILY) is True
    assert _config_matches_report_type(config, ReportType.WEEKLY) is False


def test_split_daily_config_does_not_match_unsplit_daily_job() -> None:
    """A split daily-only config is not picked up by an unsplit daily invocation."""
    config = UserReportConfig(
        user_id=uuid4(),
        report_frequency=ReportType.DAILY_MORNING,
        report_frequencies=["daily_morning"],
    )

    assert _config_matches_report_type(config, ReportType.DAILY_MORNING) is True
    assert _config_matches_report_type(config, ReportType.DAILY) is False


@pytest.mark.asyncio
async def test_generate_scheduled_reports_skips_existing_overlapping_report(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scheduled report generation does not insert a duplicate overlapping report."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    user = User(
        id=uuid4(),
        email="scheduled@example.com",
        hashed_password="hash",
        display_name="Scheduled",
    )
    period_start, period_end = _period_for(
        ReportType.DAILY_MORNING,
        datetime(2026, 5, 27, 2, 0, tzinfo=UTC),
    )
    async with session_factory() as db:
        db.add(user)
        db.add(
            UserReportConfig(
                user_id=user.id,
                report_frequency=ReportType.DAILY_MORNING,
                report_frequencies=["daily_morning"],
                markets=["us"],
                categories=["finance"],
                is_active=True,
            )
        )
        db.add(
            Report(
                report_type=ReportType.DAILY_MORNING,
                title="Existing",
                content="# Existing",
                market_scope=["us"],
                category_scope=["finance"],
                period_start=period_start,
                period_end=period_end,
                user_id=user.id,
                item_count=0,
                sentiment_score=0.5,
            )
        )
        await db.commit()

    async def fail_generate(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("overlapping scheduled report should be skipped")

    monkeypatch.setattr(
        "app.scheduler.jobs.datetime",
        _FixedDateTime,
    )
    monkeypatch.setattr("app.scheduler.jobs.generate_report", fail_generate)

    try:
        await generate_scheduled_reports(ReportType.DAILY_MORNING, session_factory)
    finally:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.mark.asyncio
async def test_generate_scheduled_reports_allows_other_users_overlapping_report(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One user's overlapping report does not block another user's scheduled report."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    existing_user = User(
        id=uuid4(),
        email="existing-scheduled@example.com",
        hashed_password="hash",
        display_name="Existing Scheduled",
    )
    target_user = User(
        id=uuid4(),
        email="target-scheduled@example.com",
        hashed_password="hash",
        display_name="Target Scheduled",
    )
    period_start, period_end = _period_for(
        ReportType.DAILY_MORNING,
        datetime(2026, 5, 27, 2, 0, tzinfo=UTC),
    )
    async with session_factory() as db:
        db.add_all([existing_user, target_user])
        db.add(
            UserReportConfig(
                user_id=target_user.id,
                report_frequency=ReportType.DAILY_MORNING,
                report_frequencies=["daily_morning"],
                markets=["us"],
                categories=["finance"],
                is_active=True,
            )
        )
        db.add(
            Report(
                report_type=ReportType.DAILY_MORNING,
                title="Other User Existing",
                content="# Existing",
                market_scope=["us"],
                category_scope=["finance"],
                period_start=period_start,
                period_end=period_end,
                user_id=existing_user.id,
                item_count=0,
                sentiment_score=0.5,
            )
        )
        await db.commit()

    async def fake_generate(
        db,
        report_type,
        market_scope,
        category_scope,
        generated_start,
        generated_end,
        **kwargs,
    ) -> Report:
        report = Report(
            report_type=report_type,
            title="Generated",
            content="# Generated",
            market_scope=market_scope,
            category_scope=category_scope,
            period_start=generated_start,
            period_end=generated_end,
            user_id=kwargs["user_id"],
            item_count=0,
            sentiment_score=0.5,
        )
        db.add(report)
        await db.flush()
        return report

    monkeypatch.setattr("app.scheduler.jobs.datetime", _FixedDateTime)
    monkeypatch.setattr("app.scheduler.jobs.generate_report", fake_generate)

    try:
        await generate_scheduled_reports(ReportType.DAILY_MORNING, session_factory)

        async with session_factory() as db:
            target_report = await db.scalar(
                select(Report).where(
                    Report.user_id == target_user.id,
                    Report.title == "Generated",
                )
            )
        assert target_report is not None
    finally:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.mark.asyncio
async def test_generate_scheduled_reports_continues_after_user_failure(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A failing user's scheduled report does not abort or erase other users."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    users = [
        User(
            id=uuid4(),
            email=f"scheduled-{index}@example.com",
            hashed_password="hash",
            display_name=f"Scheduled {index}",
        )
        for index in range(3)
    ]
    async with session_factory() as db:
        db.add_all(users)
        db.add_all(
            [
                UserReportConfig(
                    user_id=user.id,
                    report_frequency=ReportType.DAILY_MORNING,
                    report_frequencies=["daily_morning"],
                    markets=["us"],
                    categories=["finance"],
                    is_active=True,
                )
                for user in users
            ]
        )
        await db.commit()

    calls = []

    async def fake_generate(
        db,
        report_type,
        market_scope,
        category_scope,
        generated_start,
        generated_end,
        **kwargs,
    ) -> Report:
        user_id = kwargs["user_id"]
        calls.append(user_id)
        if len(calls) == 2:
            raise RuntimeError("simulated LLM failure")
        report = Report(
            report_type=report_type,
            title=f"Generated {user_id}",
            content="# Generated",
            market_scope=market_scope,
            category_scope=category_scope,
            period_start=generated_start,
            period_end=generated_end,
            user_id=user_id,
            item_count=0,
            sentiment_score=0.5,
        )
        db.add(report)
        await db.flush()
        return report

    monkeypatch.setattr("app.scheduler.jobs.datetime", _FixedDateTime)
    monkeypatch.setattr("app.scheduler.jobs.generate_report", fake_generate)
    caplog.set_level("ERROR", logger="app.scheduler.jobs")

    try:
        await generate_scheduled_reports(ReportType.DAILY_MORNING, session_factory)

        async with session_factory() as db:
            stored_user_ids = set(await db.scalars(select(Report.user_id)))
        assert calls == [user.id for user in users]
        assert stored_user_ids == {calls[0], calls[2]}
        assert "Report generation failed for user=" in caplog.text
    finally:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


async def asyncio_sleep() -> None:
    import asyncio

    await asyncio.sleep(0)


class _FixedDateTime(datetime):
    @classmethod
    def now(cls, tz: timezone | None = None) -> datetime:
        current = datetime(2026, 5, 27, 2, 0, tzinfo=UTC)
        return current if tz is None else current.astimezone(tz)


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
