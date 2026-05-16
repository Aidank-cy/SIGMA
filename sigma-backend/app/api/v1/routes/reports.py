import asyncio
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.report_generator import generate_report
from app.database import AsyncSessionLocal, get_db
from app.middleware.auth import require_role
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


@router.get("", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    report_type: ReportType | None = None,
    market: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> ReportListResponse:
    """Return generated reports with standard pagination metadata."""
    predicate = _report_predicate(report_type, market, date_from, date_to)
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
async def latest_reports(db: AsyncSession = Depends(get_db)) -> LatestReportsResponse:
    """Return the latest report for each report type."""
    items: list[ReportSummary] = []
    for report_type in ReportType:
        report = await db.scalar(
            select(Report)
            .where(Report.report_type == report_type)
            .order_by(Report.generated_at.desc())
            .limit(1)
        )
        if report is not None:
            items.append(ReportSummary.model_validate(report))
    return LatestReportsResponse(items=items)


@router.get("/{report_id}", response_model=ReportDetail)
async def get_report(report_id: UUID, db: AsyncSession = Depends(get_db)) -> ReportDetail:
    """Return a full generated report."""
    report = await db.scalar(select(Report).where(Report.id == report_id))
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportDetail.model_validate(report)


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_report_endpoint(
    payload: ManualReportGenerateRequest,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> dict[str, str]:
    """Queue manual report generation."""
    asyncio.create_task(_generate_report_task(payload))
    return {"status": "accepted"}


async def _generate_report_task(payload: ManualReportGenerateRequest) -> None:
    async with AsyncSessionLocal() as db:
        await generate_report(
            db,
            payload.report_type,
            payload.market_scope,
            payload.category_scope,
            payload.period_start,
            payload.period_end,
            payload.locale,
        )
        await db.commit()


def _report_predicate(
    report_type: ReportType | None,
    market: str | None,
    date_from: date | None,
    date_to: date | None,
) -> list[object]:
    predicate: list[object] = []
    if report_type is not None:
        predicate.append(Report.report_type == report_type)
    if market:
        predicate.append(Report.market_scope.contains([market]))
    if date_from:
        predicate.append(Report.period_end >= date_from)
    if date_to:
        predicate.append(Report.period_start <= date_to)
    return predicate
