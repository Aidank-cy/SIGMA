import asyncio
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_admin, get_current_user
from app.models.enums import ReportType
from app.models.user import User
from app.schemas.report import (
    LatestReportsResponse,
    ManualReportGenerateRequest,
    ReportDetail,
    ReportListResponse,
)
from app.services import report_service

router = APIRouter()
BACKGROUND_TASKS: set[asyncio.Task[None]] = set()
_generate_report_task = report_service.generate_report_task


@router.get("", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    report_type: ReportType | None = None,
    market: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportListResponse:
    """Return generated reports with standard pagination metadata."""
    return await report_service.list_reports(
        db, page, page_size, report_type, market, date_from, date_to, current_user.id
    )


@router.get("/latest", response_model=LatestReportsResponse)
async def latest_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LatestReportsResponse:
    """Return the latest report for each report type."""
    return await report_service.latest_reports(db, current_user.id)


@router.get("/{report_id}", response_model=ReportDetail)
async def get_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetail:
    """Return a full generated report."""
    return await report_service.get_report(db, report_id, current_user.id)


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_report_endpoint(
    payload: ManualReportGenerateRequest,
    admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    """Queue manual report generation."""
    _queue_report_generation(payload, admin.id)
    return {"status": "accepted"}


@router.post("/generate-mine", status_code=status.HTTP_202_ACCEPTED)
async def generate_user_report(
    payload: ManualReportGenerateRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Queue report generation for the current authenticated user."""
    _queue_report_generation(payload, current_user.id)
    return {"status": "accepted"}


def _queue_report_generation(payload: ManualReportGenerateRequest, user_id: UUID) -> None:
    task = asyncio.create_task(_generate_report_task(payload, user_id))
    if hasattr(task, "add_done_callback"):
        BACKGROUND_TASKS.add(task)
        task.add_done_callback(BACKGROUND_TASKS.discard)
