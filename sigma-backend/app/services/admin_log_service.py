from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus
from app.schemas.admin import AdminLogListResponse, RecentActivityItem


async def list_admin_logs(
    db: AsyncSession,
    page: int,
    page_size: int,
    source_id: UUID | None,
    status_filter: CollectorStatus | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> AdminLogListResponse:
    """List collector logs with admin filters."""
    predicate = []
    if source_id:
        predicate.append(CollectorLog.source_id == source_id)
    if status_filter:
        predicate.append(CollectorLog.status == status_filter)
    if date_from:
        predicate.append(CollectorLog.executed_at >= date_from)
    if date_to:
        predicate.append(CollectorLog.executed_at <= date_to)

    total = await db.scalar(select(func.count()).select_from(CollectorLog).where(*predicate))
    success_total = await db.scalar(
        select(func.count())
        .select_from(CollectorLog)
        .where(*predicate, CollectorLog.status == CollectorStatus.SUCCESS)
    )
    rows = (
        await db.execute(
            select(CollectorLog, DataSource.name)
            .join(DataSource, DataSource.id == CollectorLog.source_id)
            .where(*predicate)
            .order_by(CollectorLog.executed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    total_value = total or 0
    return AdminLogListResponse(
        page=page,
        page_size=page_size,
        total=total_value,
        has_next=(page * page_size) < total_value,
        success_rate=(success_total or 0) / total_value if total_value else 0.0,
        items=[_activity_item(log, source_name) for log, source_name in rows],
    )


def _activity_item(log: CollectorLog, source_name: str) -> RecentActivityItem:
    return RecentActivityItem(
        id=log.id,
        source_id=log.source_id,
        source_name=source_name,
        status=log.status,
        items_count=log.items_count,
        error_message=log.error_message,
        duration_ms=log.duration_ms,
        executed_at=log.executed_at,
    )
