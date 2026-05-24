import asyncio
from datetime import date, datetime, timedelta, timezone
from time import perf_counter
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.analyzers.report_generator import generate_report
from app.analyzers.summarizer import batch_summarize
from app.collectors.dedup import filter_new_items
from app.collectors.factory import create_collector
from app.collectors.normalizer import normalize_items
from app.database import AsyncSessionLocal
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, IntelligenceCategory, Market, ReportType
from app.models.user_report_config import UserReportConfig
from app.schemas.item import CollectedItemCreate
from app.services.market_candles import candle_refresh_job
from app.services.market_indices import any_market_trading_now, refresh_market_indices
from app.utils.event_hooks import notify_new_items
from app.utils.redis_lock import acquire_lock, release_lock

__all__ = ["candle_refresh_job"]


async def collect_from_source(
    source_id: UUID,
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Collect, normalize, deduplicate, persist, and log one source run."""
    started = perf_counter()
    lock_key = f"collector:lock:{source_id}"
    lock_acquired = False
    status = CollectorStatus.FAIL
    items_count = 0
    error_message: str | None = None
    item_ids: list[UUID] = []

    async with session_factory() as db:
        source = await db.scalar(select(DataSource).where(DataSource.id == source_id))
        if source is None:
            return

        try:
            lock_acquired = await acquire_lock(
                lock_key,
                ttl=source.max_execution_seconds + 60,
            )
            if not lock_acquired:
                error_message = "Collector lock already held"
                return

            collector = create_collector(source)
            raw_items = await asyncio.wait_for(
                collector.collect(),
                timeout=source.max_execution_seconds,
            )
            normalized = normalize_items(source, raw_items)
            new_items = await filter_new_items(db, normalized)
            item_ids = await _insert_new_items(db, new_items)
            if item_ids:
                await notify_new_items(item_ids)
            items_count = len(item_ids)
            status = CollectorStatus.SUCCESS
        except TimeoutError:
            status = CollectorStatus.TIMEOUT
            error_message = f"Collector timed out after {source.max_execution_seconds}s"
            await db.rollback()
        except Exception as exc:
            status = CollectorStatus.FAIL
            error_message = str(exc)
            await db.rollback()
        finally:
            if lock_acquired:
                await release_lock(lock_key)
            await _write_log(db, source_id, status, items_count, error_message, started)
    if status == CollectorStatus.SUCCESS and item_ids:
        asyncio.create_task(batch_summarize(item_ids, session_factory=session_factory))


async def cleanup_expired_items(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Delete collected items past their retention time."""
    async with session_factory() as db:
        await db.execute(delete(CollectedItem).where(CollectedItem.expires_at < datetime.now(timezone.utc)))
        await db.commit()


async def refresh_market_indices_job() -> None:
    """Refresh cached market index quotes while any configured market is open."""
    if any_market_trading_now():
        await refresh_market_indices(force=False)


async def generate_scheduled_reports(
    report_type: ReportType,
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Generate deduplicated reports for active user report configurations."""
    async with session_factory() as db:
        configs = list(await db.scalars(
            select(UserReportConfig).where(
                UserReportConfig.is_active.is_(True),
                UserReportConfig.report_frequency == report_type,
            )
        ))
        scopes = {
            (config.user_id, tuple(config.markets), tuple(config.categories))
            for config in configs
        }
        period_start, period_end = _period_for(report_type)
        for user_id, markets, categories in scopes:
            await generate_report(
                db,
                report_type,
                list(markets),
                list(categories),
                period_start,
                period_end,
                user_id=user_id,
            )
        await db.commit()


def _period_for(report_type: ReportType) -> tuple[date, date]:
    today = datetime.now(timezone.utc).date()
    if report_type == ReportType.DAILY:
        return today, today
    if report_type == ReportType.WEEKLY:
        return today - timedelta(days=6), today
    first_day = today.replace(day=1)
    return first_day, today


async def _write_log(
    db: AsyncSession,
    source_id: UUID,
    status: CollectorStatus,
    items_count: int,
    error_message: str | None,
    started: float,
) -> None:
    duration_ms = int((perf_counter() - started) * 1000)
    db.add(
        CollectorLog(
            source_id=source_id,
            status=status,
            items_count=items_count,
            error_message=error_message,
            duration_ms=duration_ms,
        )
    )
    await db.commit()


async def _insert_new_items(db: AsyncSession, new_items: list[CollectedItemCreate]) -> list[UUID]:
    if not new_items:
        return []

    items_data = [
        {
            "source_id": item.source_id,
            "title": item.title,
            "content_raw": item.content_raw,
            "content_url": item.content_url,
            "summary": item.summary,
            "category": IntelligenceCategory(item.category),
            "market": Market(item.market),
            "published_at": item.published_at,
            "expires_at": item.expires_at,
            "metadata_extra": item.metadata_extra,
        }
        for item in new_items
    ]
    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect == "postgresql":
        statement = (
            postgresql_insert(CollectedItem)
            .values(items_data)
            .on_conflict_do_nothing(index_elements=["content_url"])
            .returning(CollectedItem.id)
        )
        result = await db.execute(statement)
        return list(result.scalars())
    if dialect == "sqlite":
        statement = (
            sqlite_insert(CollectedItem)
            .values(items_data)
            .on_conflict_do_nothing(index_elements=["content_url"])
            .returning(CollectedItem.id)
        )
        result = await db.execute(statement)
        return list(result.scalars())

    item_models = [CollectedItem(**item_data) for item_data in items_data]
    db.add_all(item_models)
    await db.flush()
    return [item.id for item in item_models]
