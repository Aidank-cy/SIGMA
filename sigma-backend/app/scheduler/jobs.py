import asyncio
import logging
from datetime import UTC, datetime, time, timedelta
from time import perf_counter
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

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
from app.models.report import Report
from app.models.user_report_config import UserReportConfig
from app.schemas.item import CollectedItemCreate
from app.services.market.indices import any_market_trading_now, refresh_market_indices
from app.services.market_candles import candle_refresh_job
from app.utils.event_hooks import notify_new_items
from app.utils.redis_lock import acquire_lock, release_lock

__all__ = ["candle_refresh_job"]

BEIJING_TZ = ZoneInfo("Asia/Shanghai")
LOGGER = logging.getLogger(__name__)
BACKGROUND_TASKS: set[asyncio.Task[None]] = set()


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
        task = asyncio.create_task(batch_summarize(item_ids, session_factory=session_factory))
        if hasattr(task, "add_done_callback"):
            BACKGROUND_TASKS.add(task)
            task.add_done_callback(BACKGROUND_TASKS.discard)


async def cleanup_expired_items(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Delete collected items past their retention time."""
    async with session_factory() as db:
        await db.execute(delete(CollectedItem).where(CollectedItem.expires_at < datetime.now(UTC)))
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
    resolved_type = ReportType(report_type)
    async with session_factory() as db:
        active_configs = list(
            await db.scalars(select(UserReportConfig).where(UserReportConfig.is_active.is_(True)))
        )
        configs: list[tuple[UUID, list[Any], list[Any], dict[str, Any]]] = []
        for config in active_configs:
            if not _config_matches_report_type(config, resolved_type):
                continue
            time_ranges = config.time_ranges if isinstance(config.time_ranges, dict) else {}
            configs.append(
                (
                    config.user_id,
                    list(config.markets),
                    list(config.categories),
                    time_ranges,
                )
            )
        for user_id, markets, categories, time_ranges in configs:
            period_start, period_end = _period_for(
                resolved_type,
                time_ranges=time_ranges,
            )
            if await _report_exists_for_period(
                db,
                resolved_type,
                period_start,
                period_end,
                user_id=user_id,
            ):
                continue
            try:
                await generate_report(
                    db,
                    resolved_type,
                    markets,
                    categories,
                    period_start,
                    period_end,
                    user_id=user_id,
                )
                await db.commit()
            except Exception:
                LOGGER.exception(
                    "Report generation failed for user=%s type=%s",
                    user_id,
                    resolved_type.value,
                )
                await db.rollback()
        await db.commit()


def _config_frequencies_for(report_type: ReportType) -> tuple[ReportType, ...]:
    return (report_type,)


def _config_matches_report_type(config: UserReportConfig, report_type: ReportType) -> bool:
    frequencies = config.report_frequencies or [config.report_frequency.value]
    configured = {ReportType(value) for value in frequencies}
    if report_type in {ReportType.DAILY_MORNING, ReportType.DAILY_AFTERNOON}:
        return ReportType.DAILY in configured or report_type in configured
    return report_type in configured


async def _report_exists_for_period(
    db: AsyncSession,
    report_type: ReportType,
    period_start: datetime,
    period_end: datetime,
    user_id: UUID | None = None,
) -> bool:
    predicates = [
        Report.report_type == report_type,
        Report.period_start <= period_end,
        Report.period_end >= period_start,
    ]
    if user_id is not None:
        predicates.append(Report.user_id == user_id)
    else:
        predicates.append(Report.user_id.is_(None))
    existing = await db.scalar(select(Report).where(*predicates).limit(1))
    return existing is not None


def _period_for(
    report_type: ReportType,
    now: datetime | None = None,
    time_ranges: dict[str, Any] | None = None,
) -> tuple[datetime, datetime]:
    local_now = (now or datetime.now(UTC)).astimezone(BEIJING_TZ)
    today = local_now.date()
    if report_type == ReportType.DAILY_MORNING:
        return (
            datetime.combine(today - timedelta(days=1), time(17, 30, 1), tzinfo=BEIJING_TZ),
            datetime.combine(today, time(9, 20, 0), tzinfo=BEIJING_TZ),
        )
    if report_type == ReportType.DAILY_AFTERNOON:
        return (
            datetime.combine(today, time(9, 20, 1), tzinfo=BEIJING_TZ),
            datetime.combine(today, time(17, 30, 0), tzinfo=BEIJING_TZ),
        )
    if report_type == ReportType.DAILY:
        return (
            datetime.combine(today, time.min, tzinfo=BEIJING_TZ),
            datetime.combine(today, time(23, 59, 59), tzinfo=BEIJING_TZ),
        )
    if report_type == ReportType.WEEKLY:
        configured = (time_ranges or {}).get(ReportType.WEEKLY.value)
        friday = today - timedelta(days=(today.weekday() - 4) % 7)
        if isinstance(configured, dict):
            start_offset = _int_or_none(configured.get("start_day_offset"))
            end_offset = _int_or_none(configured.get("end_day_offset"))
            start_time = _parse_hhmm(configured.get("start_time"))
            end_time = _parse_hhmm(configured.get("end_time"))
            if (
                start_offset is not None
                and end_offset is not None
                and start_time is not None
                and end_time is not None
            ):
                return (
                    datetime.combine(
                        friday - timedelta(days=start_offset), start_time, tzinfo=BEIJING_TZ
                    ),
                    datetime.combine(
                        friday - timedelta(days=end_offset), end_time, tzinfo=BEIJING_TZ
                    ),
                )
        return (
            datetime.combine(friday - timedelta(days=7), time(17, 45, 1), tzinfo=BEIJING_TZ),
            datetime.combine(friday, time(17, 44, 0), tzinfo=BEIJING_TZ),
        )
    first_day_this_month = today.replace(day=1)
    last_day_previous_month = first_day_this_month - timedelta(days=1)
    first_day_previous_month = last_day_previous_month.replace(day=1)
    configured = (time_ranges or {}).get(ReportType.MONTHLY.value)
    if isinstance(configured, dict):
        start_day = _int_or_none(configured.get("start_day_of_month"))
        end_day = _int_or_none(configured.get("end_day_of_month"))
        if start_day is not None and end_day is not None:
            resolved_start_day = min(start_day, last_day_previous_month.day)
            resolved_end_day = min(end_day, last_day_previous_month.day)
            return (
                datetime.combine(
                    first_day_previous_month.replace(day=resolved_start_day),
                    time.min,
                    tzinfo=BEIJING_TZ,
                ),
                datetime.combine(
                    first_day_previous_month.replace(day=resolved_end_day),
                    time(23, 59, 59),
                    tzinfo=BEIJING_TZ,
                ),
            )
    return (
        datetime.combine(first_day_previous_month, time.min, tzinfo=BEIJING_TZ),
        datetime.combine(last_day_previous_month, time(23, 59, 59), tzinfo=BEIJING_TZ),
    )


def _int_or_none(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _parse_hhmm(value: object) -> time | None:
    if not isinstance(value, str):
        return None
    parts = value.split(":")
    if len(parts) != 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except ValueError:
        return None
    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        return None
    return time(hours, minutes)


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
