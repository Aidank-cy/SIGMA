from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes.items import get_item, list_items
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


@pytest.mark.asyncio
async def test_items_list_with_pagination_and_category_filter(db_session: AsyncSession) -> None:
    """Items API returns paginated category-filtered results."""
    source = _source()
    db_session.add(source)
    db_session.add_all(
        [
            _item(source, "Finance A", IntelligenceCategory.FINANCE),
            _item(source, "Finance B", IntelligenceCategory.FINANCE),
            _item(source, "Tech C", IntelligenceCategory.TECHNOLOGY),
        ]
    )
    await db_session.commit()

    response = await list_items(page=1, page_size=1, category="finance", format="minimal", db=db_session)

    assert response.total == 2
    assert response.has_next is True
    assert len(response.items) == 1
    assert response.items[0].category == "finance"


@pytest.mark.asyncio
async def test_items_detail_includes_related_items(db_session: AsyncSession) -> None:
    """Item detail includes up to five related category and market matches."""
    source = _source()
    target = _item(source, "Target", IntelligenceCategory.FINANCE)
    related = _item(source, "Related", IntelligenceCategory.FINANCE)
    unrelated = _item(source, "Other", IntelligenceCategory.TECHNOLOGY)
    db_session.add_all([source, target, related, unrelated])
    await db_session.commit()
    await db_session.refresh(target)

    detail = await get_item(target.id, db_session)

    assert detail.title == "Target"
    assert [item.title for item in detail.related] == ["Related"]


def _source() -> DataSource:
    return DataSource(
        id=uuid4(),
        name=f"items-source-{uuid4()}",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://rss.test/feed.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
    )


def _item(source: DataSource, title: str, category: IntelligenceCategory) -> CollectedItem:
    return CollectedItem(
        source_id=source.id,
        title=title,
        content_raw=f"{title} content",
        content_url=f"https://items.test/{uuid4()}",
        summary=f"{title} summary",
        category=category,
        market=Market.US,
        published_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
