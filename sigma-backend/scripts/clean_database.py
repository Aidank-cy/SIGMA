"""Delete collected SIGMA content while preserving one admin and one test user.

Run from the backend directory:
    python scripts/clean_database.py
"""

from __future__ import annotations

# ruff: noqa: E402

import asyncio
import sys
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import AsyncSessionLocal, engine
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import UserRole
from app.models.llm_usage_log import LLMUsageLog
from app.models.report import Report
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.models.watchlist import Watchlist


async def main() -> None:
    async with AsyncSessionLocal() as db:
        keep_user_ids = await _users_to_keep(db)
        deleted_users = await db.scalars(select(User.id).where(User.id.not_in(keep_user_ids)))
        deleted_user_ids = list(deleted_users)

        await db.execute(delete(CollectedItem))
        await db.execute(delete(Report))
        await db.execute(delete(Watchlist))
        await db.execute(delete(CollectorLog))
        await db.execute(delete(LLMUsageLog))

        if deleted_user_ids:
            await db.execute(delete(UserReportConfig).where(UserReportConfig.user_id.in_(deleted_user_ids)))
            await db.execute(
                update(DataSource)
                .where(DataSource.created_by.in_(deleted_user_ids))
                .values(created_by=None)
            )
            await db.execute(delete(User).where(User.id.in_(deleted_user_ids)))

        await db.commit()

    await engine.dispose()


async def _users_to_keep(db: AsyncSession) -> list[UUID]:
    admin = await db.scalar(
        select(User)
        .where(
            User.role == UserRole.ADMIN,
            or_(
                User.email.ilike("%admin%"),
                User.display_name.ilike("%admin%"),
            ),
        )
        .order_by(User.created_at.asc())
        .limit(1)
    )
    test = await db.scalar(
        select(User)
        .where(
            or_(
                User.email.ilike("%test%"),
                User.display_name.ilike("%test%"),
            ),
        )
        .order_by(User.created_at.asc())
        .limit(1)
    )
    return [user.id for user in (admin, test) if user is not None]


if __name__ == "__main__":
    asyncio.run(main())
