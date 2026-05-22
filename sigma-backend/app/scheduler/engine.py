from collections.abc import Callable
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import AsyncSessionLocal
from app.models.data_source import DataSource
from app.models.enums import ReportType
from app.scheduler.jobs import (
    cleanup_expired_items,
    collect_from_source,
    generate_scheduled_reports,
    refresh_market_indices_job,
)
from app.services.market_candles import candle_refresh_job

scheduler = AsyncIOScheduler(timezone="UTC")


async def start_scheduler(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Start the scheduler and register active source jobs."""
    if not scheduler.running:
        scheduler.start()
    await load_source_jobs(session_factory)
    add_cleanup_job(session_factory)
    add_report_jobs(session_factory)
    add_market_indices_job()


async def stop_scheduler() -> None:
    """Stop the scheduler if it is running."""
    if scheduler.running:
        scheduler.shutdown(wait=False)


async def load_source_jobs(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Load all active data source jobs from the database."""
    async with session_factory() as db:
        sources = await db.scalars(select(DataSource).where(DataSource.is_active.is_(True)))
        for source in sources:
            add_or_update_source_job(source, session_factory)


def add_or_update_source_job(
    source: DataSource,
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Register or replace a single source collection job."""
    scheduler.add_job(
        collect_from_source,
        trigger=CronTrigger.from_crontab(source.schedule_cron, timezone="UTC"),
        id=_source_job_id(source.id),
        args=[source.id, session_factory],
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )


def remove_source_job(source_id: UUID) -> None:
    """Remove a source collection job if it exists."""
    job_id = _source_job_id(source_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def add_cleanup_job(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    job_func: Callable[..., object] = cleanup_expired_items,
) -> None:
    """Register the daily expired item cleanup job."""
    scheduler.add_job(
        job_func,
        trigger=CronTrigger(hour=3, minute=0, timezone="UTC"),
        id="cleanup_expired_items",
        args=[session_factory],
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )


def add_report_jobs(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    job_func: Callable[..., object] = generate_scheduled_reports,
) -> None:
    """Register periodic report generation jobs."""
    scheduler.add_job(
        job_func,
        trigger=CronTrigger(hour=22, minute=0, timezone="UTC"),
        id="reports:daily",
        args=[ReportType.DAILY, session_factory],
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        job_func,
        trigger=CronTrigger(day_of_week="sun", hour=22, minute=0, timezone="UTC"),
        id="reports:weekly",
        args=[ReportType.WEEKLY, session_factory],
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        job_func,
        trigger=CronTrigger(day="last", hour=22, minute=0, timezone="UTC"),
        id="reports:monthly",
        args=[ReportType.MONTHLY, session_factory],
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )


def add_market_indices_job(job_func: Callable[..., object] = refresh_market_indices_job) -> None:
    """Register the near-real-time market indices cache refresh job."""
    scheduler.add_job(
        job_func,
        trigger=IntervalTrigger(seconds=15, timezone="UTC"),
        id="market-indices:refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        candle_refresh_job,
        trigger=IntervalTrigger(seconds=10, timezone="UTC"),
        id="market-candles:refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )


def _source_job_id(source_id: UUID) -> str:
    return f"collector:{source_id}"
