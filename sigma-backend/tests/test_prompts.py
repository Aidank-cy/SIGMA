from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.analyzers.prompts import (
    report_system_prompt,
    report_user_prompt,
    summary_system_prompt,
    summary_user_prompt,
)
from app.models.collected_item import CollectedItem
from app.models.enums import IntelligenceCategory, Market


def test_summary_prompt_truncates_content() -> None:
    """Summary user prompts bound raw item content to 3000 characters."""
    item = _item("Long", "x" * 4000)

    prompt = summary_user_prompt(item)

    assert "Title: Long" in prompt
    assert "x" * 3001 not in prompt


def test_summary_system_prompt_requires_json_and_locale() -> None:
    """Summary system prompt requires the JSON shape used by the summarizer."""
    prompt = summary_system_prompt("en")

    assert "valid JSON" in prompt
    assert "sentiment" in prompt
    assert "summary" in prompt
    assert "keywords" in prompt
    assert "en" in prompt


def test_report_prompt_includes_required_sections_instruction() -> None:
    """Report system prompt names the expected markdown sections."""
    item = _item("A", "content")
    system_prompt = report_system_prompt("zh", 2000, "Daily Morning")
    user_prompt = report_user_prompt(
        "daily",
        "Daily",
        "2026-05-16",
        "2026-05-16",
        ["us"],
        ["finance"],
        [item],
    )

    assert "Executive Summary" in system_prompt
    assert "Cross-Market Dynamics" in system_prompt
    assert "Political Risk" in system_prompt
    assert "Technology & Innovation" in system_prompt
    assert "Sources" in system_prompt
    assert "titles and URLs" in system_prompt
    assert "FORMATTING RULES" in system_prompt
    assert "reverse-chronological vertical timeline" in system_prompt
    assert "must NOT contain underscores" in system_prompt
    assert "Beijing Time" not in system_prompt
    assert "2000 tokens" in system_prompt
    assert "Report type: daily" in user_prompt
    assert "Report label: Daily" in user_prompt
    assert item.content_url in user_prompt


def _item(title: str, content: str) -> CollectedItem:
    return CollectedItem(
        id=uuid4(),
        source_id=uuid4(),
        title=title,
        content_raw=content,
        content_url=f"https://prompt.test/{uuid4()}",
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
