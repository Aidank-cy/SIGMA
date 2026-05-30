import logging
from datetime import UTC, date, datetime, time
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.report_generator import generate_report
from app.database import AsyncSessionLocal
from app.models.enums import ReportType
from app.models.report import Report
from app.schemas.report import (
    LatestReportsResponse,
    ManualReportGenerateRequest,
    ReportDetail,
    ReportListResponse,
    ReportSummary,
)
from app.services.pagination import paginate_scalars

LOGGER = logging.getLogger(__name__)


async def list_reports(
    db: AsyncSession,
    page: int,
    page_size: int,
    report_type: ReportType | None,
    market: str | None,
    date_from: date | None,
    date_to: date | None,
    user_id: UUID,
) -> ReportListResponse:
    """Return generated reports with standard pagination metadata."""
    predicate = _report_predicate(report_type, market, date_from, date_to, user_id)
    page_result = await paginate_scalars(
        db,
        select(Report).where(*predicate).order_by(Report.generated_at.desc()),
        page,
        page_size,
        select(func.count()).select_from(Report).where(*predicate),
    )
    return ReportListResponse(
        page=page,
        page_size=page_size,
        total=page_result.total,
        has_next=page_result.has_next,
        items=[ReportSummary.model_validate(report) for report in page_result.items],
    )


async def latest_reports(db: AsyncSession, user_id: UUID) -> LatestReportsResponse:
    """Return the latest report for each report type."""
    items: list[ReportSummary] = []
    for report_type in ReportType:
        report = await db.scalar(
            select(Report)
            .where(Report.report_type == report_type, Report.user_id == user_id)
            .order_by(Report.generated_at.desc())
            .limit(1)
        )
        if report is not None:
            items.append(ReportSummary.model_validate(report))
    return LatestReportsResponse(items=items)


async def get_report(db: AsyncSession, report_id: UUID, user_id: UUID) -> ReportDetail:
    """Return a full generated report."""
    report = await db.scalar(select(Report).where(Report.id == report_id))
    if report is None or (report.user_id is not None and report.user_id != user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportDetail.model_validate(report)


async def generate_report_task(payload: ManualReportGenerateRequest, user_id: UUID) -> None:
    """Generate a report in a background task and log failures."""
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
        LOGGER.exception(
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
) -> list[Any]:
    predicate: list[Any] = [Report.user_id == user_id]
    if report_type is not None:
        predicate.append(Report.report_type == report_type)
    if market:
        predicate.append(Report.market_scope.contains([market]))
    if date_from:
        predicate.append(Report.period_end >= datetime.combine(date_from, time.min, tzinfo=UTC))
    if date_to:
        predicate.append(Report.period_start <= datetime.combine(date_to, time.max, tzinfo=UTC))
    return predicate
