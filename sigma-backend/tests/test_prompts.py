from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.analyzers.prompts import report_system_prompt, report_user_prompt, summary_user_prompt
from app.models.collected_item import CollectedItem
from app.models.enums import IntelligenceCategory, Market


def test_summary_prompt_truncates_content() -> None:
    """Summary user prompts bound raw item content to 3000 characters."""
    item = _item("Long", "x" * 4000)

    prompt = summary_user_prompt(item)

    assert "Title: Long" in prompt
    assert "x" * 3001 not in prompt


def test_report_prompt_includes_required_sections_instruction() -> None:
    """Report system prompt names the expected markdown sections."""
    system_prompt = report_system_prompt("zh")
    user_prompt = report_user_prompt(
        "daily",
        "2026-05-16",
        "2026-05-16",
        ["us"],
        ["finance"],
        [_item("A", "content")],
    )

    assert "Overview" in system_prompt
    assert "Politics" in system_prompt
    assert "Tech" in system_prompt
    assert "Report type: daily" in user_prompt


def _item(title: str, content: str) -> CollectedItem:
    return CollectedItem(
        id=uuid4(),
        source_id=uuid4(),
        title=title,
        content_raw=content,
        content_url=f"https://prompt.test/{uuid4()}",
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
