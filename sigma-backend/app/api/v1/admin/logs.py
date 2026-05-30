from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_admin
from app.models.enums import CollectorStatus
from app.models.user import User
from app.schemas.admin import AdminLogListResponse
from app.services import admin_log_service

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
    _admin: User = Depends(get_current_admin),
) -> AdminLogListResponse:
    """List collector logs with admin filters."""
    return await admin_log_service.list_admin_logs(
        db, page, page_size, source_id, status, date_from, date_to
    )
