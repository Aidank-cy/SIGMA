import asyncio
from datetime import datetime, timezone
from time import perf_counter
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.collectors.dedup import filter_new_items
from app.collectors.factory import create_collector
from app.collectors.normalizer import normalize_items
from app.database import AsyncSessionLocal
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, IntelligenceCategory, Market
from app.utils.event_hooks import notify_new_items
from app.utils.redis_lock import acquire_lock, release_lock


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
            item_models = [
                CollectedItem(
                    source_id=item.source_id,
                    title=item.title,
                    content_raw=item.content_raw,
                    content_url=item.content_url,
                    summary=item.summary,
                    category=IntelligenceCategory(item.category),
                    market=Market(item.market),
                    published_at=item.published_at,
                    expires_at=item.expires_at,
                    metadata_extra=item.metadata_extra,
                )
                for item in new_items
            ]
            db.add_all(item_models)
            await db.flush()
            item_ids = [item.id for item in item_models]
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


async def cleanup_expired_items(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Delete collected items past their retention time."""
    async with session_factory() as db:
        await db.execute(delete(CollectedItem).where(CollectedItem.expires_at < datetime.now(timezone.utc)))
        await db.commit()


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
