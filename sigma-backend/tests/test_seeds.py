from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.seeds import seed_data_sources
from app.models.data_source import DataSource


async def test_seed_data_sources_creates_eight_sources(db_session: AsyncSession) -> None:
    """Seed helper inserts eight MVP system sources into an empty table."""
    created = await seed_data_sources(db_session)
    total = await db_session.scalar(select(func.count()).select_from(DataSource))

    assert created == 8
    assert total == 8
