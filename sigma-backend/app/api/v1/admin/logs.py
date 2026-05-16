from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, UserRole
from app.models.user import User
from app.schemas.admin import AdminLogListResponse, RecentActivityItem

router = APIRouter()


@router.get("", response_model=AdminLogListResponse)
async def list_admin_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    source_id: UUID | None = None,
    status: CollectorStatus | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminLogListResponse:
    """List collector logs with admin filters."""
    predicate = []
    if source_id:
        predicate.append(CollectorLog.source_id == source_id)
    if status:
        predicate.append(CollectorLog.status == status)
    if date_from:
        predicate.append(CollectorLog.executed_at >= date_from)
    if date_to:
        predicate.append(CollectorLog.executed_at <= date_to)

    total = await db.scalar(select(func.count()).select_from(CollectorLog).where(*predicate))
    success_total = await db.scalar(
        select(func.count()).select_from(CollectorLog).where(
            *predicate,
            CollectorLog.status == CollectorStatus.SUCCESS,
        )
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
    items = [
        RecentActivityItem(
            id=log.id,
            source_id=log.source_id,
            source_name=source_name,
            status=log.status,
            items_count=log.items_count,
            error_message=log.error_message,
            duration_ms=log.duration_ms,
            executed_at=log.executed_at,
        )
        for log, source_name in rows
    ]
    total_value = total or 0
    return AdminLogListResponse(
        page=page,
        page_size=page_size,
        total=total_value,
        has_next=(page * page_size) < total_value,
        success_rate=(success_total or 0) / total_value if total_value else 0.0,
        items=items,
    )
