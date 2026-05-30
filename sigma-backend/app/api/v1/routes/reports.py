import asyncio
from datetime import UTC, date, datetime, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.report_generator import generate_report
from app.database import AsyncSessionLocal, get_db
from app.middleware.auth import get_current_user, require_role
from app.models.enums import ReportType, UserRole
from app.models.report import Report
from app.models.user import User
from app.schemas.report import (
    LatestReportsResponse,
    ManualReportGenerateRequest,
    ReportDetail,
    ReportListResponse,
    ReportSummary,
)

router = APIRouter()
BACKGROUND_TASKS: set[asyncio.Task[None]] = set()


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
    predicate = _report_predicate(report_type, market, date_from, date_to, current_user.id)
    total = await db.scalar(select(func.count()).select_from(Report).where(*predicate))
    rows = await db.scalars(
        select(Report)
        .where(*predicate)
        .order_by(Report.generated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [ReportSummary.model_validate(report) for report in rows]
    return ReportListResponse(
        page=page,
        page_size=page_size,
        total=total or 0,
        has_next=(page * page_size) < (total or 0),
        items=items,
    )


@router.get("/latest", response_model=LatestReportsResponse)
async def latest_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LatestReportsResponse:
    """Return the latest report for each report type."""
    items: list[ReportSummary] = []
    for report_type in ReportType:
        report = await db.scalar(
            select(Report)
            .where(Report.report_type == report_type, Report.user_id == current_user.id)
            .order_by(Report.generated_at.desc())
            .limit(1)
        )
        if report is not None:
            items.append(ReportSummary.model_validate(report))
    return LatestReportsResponse(items=items)


@router.get("/{report_id}", response_model=ReportDetail)
async def get_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetail:
    """Return a full generated report."""
    report = await db.scalar(select(Report).where(Report.id == report_id))
    if report is None or (report.user_id is not None and report.user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportDetail.model_validate(report)


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_report_endpoint(
    payload: ManualReportGenerateRequest,
    admin: User = Depends(require_role(UserRole.ADMIN)),
) -> dict[str, str]:
    """Queue manual report generation."""
    task = asyncio.create_task(_generate_report_task(payload, admin.id))
    if hasattr(task, "add_done_callback"):
        BACKGROUND_TASKS.add(task)
        task.add_done_callback(BACKGROUND_TASKS.discard)
    return {"status": "accepted"}


@router.post("/generate-mine", status_code=status.HTTP_202_ACCEPTED)
async def generate_user_report(
    payload: ManualReportGenerateRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Allow any authenticated user to generate their own report.

    Uses the caller's own API key and only their visible data sources
    (system sources + sources they created).
    """
    task = asyncio.create_task(_generate_report_task(payload, current_user.id))
    if hasattr(task, "add_done_callback"):
        BACKGROUND_TASKS.add(task)
        task.add_done_callback(BACKGROUND_TASKS.discard)
    return {"status": "accepted"}


async def _generate_report_task(payload: ManualReportGenerateRequest, user_id: UUID) -> None:
    import logging

    logger = logging.getLogger(__name__)
    try:
        async with AsyncSessionLocal() as db:
            await generate_report(
                db,
                payload.report_type,
                payload.market_scope,
                payload.category_scope,
                payload.period_start,
                payload.period_end,
                payload.locale,
                user_id,
            )
            await db.commit()
    except Exception:
        logger.exception(
            "Report generation failed for user=%s type=%s",
            user_id,
            payload.report_type,
        )


def _report_predicate(
    report_type: ReportType | None,
    market: str | None,
    date_from: date | None,
    date_to: date | None,
    user_id: UUID,
) -> list[object]:
    predicate: list[object] = [Report.user_id == user_id]
    if report_type is not None:
        predicate.append(Report.report_type == report_type)
    if market:
        predicate.append(Report.market_scope.contains([market]))
    if date_from:
        predicate.append(Report.period_end >= datetime.combine(date_from, time.min, tzinfo=UTC))
    if date_to:
        predicate.append(Report.period_start <= datetime.combine(date_to, time.max, tzinfo=UTC))
    return predicate
