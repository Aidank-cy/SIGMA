from time import perf_counter
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.enums import CollectorStatus, IntelligenceCategory, Market
from app.schemas.item import CollectedItemCreate


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
