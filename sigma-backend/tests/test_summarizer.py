from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.summarizer import _normalize_summary_payload, batch_summarize
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


@pytest.mark.asyncio
async def test_batch_summarize_writes_and_skips_existing(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Batch summarization writes missing summaries and leaves existing summaries intact."""
    source = _source()
    items = [_item(source, f"Item {index}") for index in range(5)]
    items[0].summary = "Existing summary"
    db_session.add(source)
    db_session.add_all(items)
    await db_session.commit()

    class FakeLLMClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        async def complete_json(self, _system_prompt: str, user_prompt: str, **_kwargs: object) -> dict[str, object]:
            return {
                "sentiment": "bullish",
                "summary": f"Summary for {user_prompt.splitlines()[0]}",
                "keywords": ["rates", "fed"],
            }

    monkeypatch.setattr("app.analyzers.summarizer.LLMClient", FakeLLMClient)

    await batch_summarize([item.id for item in items], db=db_session, concurrency=2)
    await db_session.commit()

    refreshed = list(await db_session.scalars(select(CollectedItem).order_by(CollectedItem.title)))
    assert refreshed[0].summary == "Existing summary"
    assert all(item.summary and "\"sentiment\":\"bullish\"" in item.summary for item in refreshed[1:])


@pytest.mark.asyncio
async def test_batch_summarize_failure_does_not_crash(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed item increments retry metadata while the batch continues."""
    source = _source()
    ok = _item(source, "Ok")
    failing = _item(source, "Fail")
    db_session.add(source)
    db_session.add_all([ok, failing])
    await db_session.commit()

    class FakeLLMClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        async def complete_json(self, _system_prompt: str, user_prompt: str, **_kwargs: object) -> dict[str, object]:
            if "Title: Fail" in user_prompt:
                raise RuntimeError("boom")
            return {"sentiment": "neutral", "summary": "Ok summary", "keywords": ["ok"]}

    monkeypatch.setattr("app.analyzers.summarizer.LLMClient", FakeLLMClient)

    await batch_summarize([ok.id, failing.id], db=db_session)
    await db_session.commit()
    await db_session.refresh(ok)
    await db_session.refresh(failing)

    assert ok.summary == '{"sentiment":"neutral","summary":"Ok summary","keywords":["ok"]}'
    assert failing.summary is None
    assert failing.metadata_extra == {"summary_retry_count": 1}


def test_normalize_summary_payload_bounds_fields() -> None:
    """Summary JSON normalization preserves only supported sentiment and keywords."""
    payload = _normalize_summary_payload(
        {
            "sentiment": "mixed",
            "summary": "Markets were choppy.",
            "keywords": ["markets", "", "rates", "credit"] * 4,
        }
    )

    assert payload == {
        "sentiment": "neutral",
        "summary": "Markets were choppy.",
        "keywords": ["markets", "rates", "credit"] * 4,
    }


def _source() -> DataSource:
    return DataSource(
        id=uuid4(),
        name=f"summary-source-{uuid4()}",
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
        content_url=f"https://summary.test/{uuid4()}",
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
