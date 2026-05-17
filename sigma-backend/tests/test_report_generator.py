from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.report_generator import generate_report
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, ReportType, SourceType


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
