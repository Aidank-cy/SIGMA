from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select, tuple_

from app.models.collected_item import CollectedItem

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy import Select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.item import CollectedItemCreate


async def filter_new_items(
    db: AsyncSession,
    items: list[CollectedItemCreate],
) -> list[CollectedItemCreate]:
    """Remove items that already exist by URL or source/title/date."""
    if not items:
        return []

    content_urls = [item.content_url for item in items if item.content_url]
    existing_urls: set[str] = set()
    if content_urls:
        url_rows = await db.scalars(
            select(CollectedItem.content_url).where(CollectedItem.content_url.in_(content_urls))
        )
        existing_urls = {url for url in url_rows if url}

    composite_keys = [
        (item.source_id, item.title)
        for item in items
        if not item.content_url or item.content_url not in existing_urls
    ]
    existing_composites: set[tuple[UUID, str]] = set()
    if composite_keys:
        statement: Select[tuple[UUID, str]] = select(
            CollectedItem.source_id,
            CollectedItem.title,
        ).where(
            tuple_(
                CollectedItem.source_id,
                CollectedItem.title,
            ).in_(composite_keys)
        )
        rows = await db.execute(statement)
        existing_composites = set(rows.all())

    seen_urls: set[str] = set()
    seen_composites: set[tuple[UUID, str]] = set()
    new_items: list[CollectedItemCreate] = []
    for item in items:
        composite = (item.source_id, item.title)
        if item.content_url and item.content_url in existing_urls:
            continue
        if item.content_url and item.content_url in seen_urls:
            continue
        if composite in existing_composites or composite in seen_composites:
            continue
        if item.content_url:
            seen_urls.add(item.content_url)
        seen_composites.add(composite)
        new_items.append(item)
    return new_items
