from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.report_generator import generate_report
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, ReportType, SourceType
from app.models.report import Report


@pytest.mark.asyncio
async def test_report_generator_creates_persisted_markdown_report(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Report generation creates a persisted markdown report from collected items."""
    source = _source()
    db_session.add(source)
    db_session.add_all([_item(source, "Bullish AI earnings"), _item(source, "Finance outlook")])
    await db_session.commit()

    class FakeLLMClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        async def complete(self, _system_prompt: str, user_prompt: str, **_kwargs: object) -> str:
            assert "Bullish AI earnings" in user_prompt
            return "# Overview\n\nAI earnings led the market narrative."

    monkeypatch.setattr("app.analyzers.report_generator.LLMClient", FakeLLMClient)

    report = await generate_report(
        db_session,
        ReportType.DAILY,
        ["us"],
        ["finance"],
        date.today(),
        date.today(),
    )
    await db_session.commit()

    stored = await db_session.scalar(select(Report).where(Report.id == report.id))
    assert stored is not None
    assert stored.title.endswith("Daily Report")
    assert stored.content.startswith("# Overview")
    assert stored.item_count == 2


@pytest.mark.asyncio
async def test_report_generator_uses_map_reduce_for_large_sets(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reports over 30 items use map summaries before final report generation."""
    source = _source()
    db_session.add(source)
    db_session.add_all([_item(source, f"Item {index}") for index in range(40)])
    await db_session.commit()
    calls: list[str] = []

    class FakeLLMClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        async def complete(self, _system_prompt: str, user_prompt: str, **_kwargs: object) -> str:
            calls.append(user_prompt)
            if "reduce pass" in user_prompt:
                return "# Overview\n\n# Politics\n\n# Finance\n\n# Tech\n\n# Timeline\n\n# Outlook"
            return "Intermediate summary"

    monkeypatch.setattr("app.analyzers.report_generator.LLMClient", FakeLLMClient)

    report = await generate_report(
        db_session,
        ReportType.DAILY,
        ["us"],
        ["finance"],
        date.today(),
        date.today(),
    )

    assert report.item_count == 40
    assert report.sentiment_score == 0
    assert "# Overview" in report.content
    assert len(calls) > 1


@pytest.mark.parametrize(
    ("report_type", "period_end", "expected"),
    [
        (
            ReportType.DAILY_MORNING,
            datetime(2026, 5, 27, 9, 20, tzinfo=ZoneInfo("Asia/Shanghai")),
            "27/05/2026 Daily Morning Report",
        ),
        (
            ReportType.DAILY_AFTERNOON,
            datetime(2026, 5, 27, 17, 30, tzinfo=ZoneInfo("Asia/Shanghai")),
            "27/05/2026 Daily Afternoon Report",
        ),
        (
            ReportType.DAILY,
            datetime(2026, 5, 27, 23, 59, tzinfo=ZoneInfo("Asia/Shanghai")),
            "27/05/2026 Daily Report",
        ),
        (
            ReportType.WEEKLY,
            datetime(2026, 5, 27, 9, 0, tzinfo=timezone.utc),
            "27/05/2026 Weekly Report",
        ),
        (
            ReportType.MONTHLY,
            datetime(2026, 5, 27, 9, 0, tzinfo=timezone.utc),
            "05/2026 Monthly Report",
        ),
    ],
)
@pytest.mark.asyncio
async def test_report_generator_formats_titles_from_beijing_period_end(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    report_type: ReportType,
    period_end: datetime,
    expected: str,
) -> None:
    """Report titles use the requested cadence and Beijing coverage end date."""

    class FakeLLMClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        async def complete(self, *_args: object, **_kwargs: object) -> str:
            return "# Overview\n\nReport body."

    monkeypatch.setattr("app.analyzers.report_generator.LLMClient", FakeLLMClient)

    report = await generate_report(
        db_session,
        report_type,
        ["us"],
        ["finance"],
        period_end - timedelta(hours=1),
        period_end,
    )

    assert report.title == expected


def _source() -> DataSource:
    return DataSource(
        id=uuid4(),
        name=f"report-source-{uuid4()}",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://rss.test/feed.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
    )


def _item(source: DataSource, title: str) -> CollectedItem:
    return CollectedItem(
        id=uuid4(),
        source_id=source.id,
        title=title,
        content_raw=f"{title} raw content",
        content_url=f"https://reports.test/{uuid4()}",
        summary=f"{title} summary",
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
