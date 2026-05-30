from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from app.models.enums import ReportType
from app.models.system_config import SystemConfig

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

REPORT_MAX_TOKEN_TYPES = (
    ReportType.DAILY_MORNING,
    ReportType.DAILY_AFTERNOON,
    ReportType.WEEKLY,
    ReportType.MONTHLY,
)

DEFAULT_REPORT_MAX_TOKENS: dict[ReportType, int] = {
    ReportType.DAILY: 2000,
    ReportType.DAILY_MORNING: 2000,
    ReportType.DAILY_AFTERNOON: 2000,
    ReportType.WEEKLY: 3000,
    ReportType.MONTHLY: 4000,
}

REPORT_TYPE_LABELS: dict[ReportType, str] = {
    ReportType.DAILY: "Daily",
    ReportType.DAILY_MORNING: "Daily Morning",
    ReportType.DAILY_AFTERNOON: "Daily Afternoon",
    ReportType.WEEKLY: "Weekly",
    ReportType.MONTHLY: "Monthly",
}


async def get_report_max_tokens(db: AsyncSession, user_id: UUID) -> dict[str, int]:
    """Return user-configured report token limits for Settings payloads."""
    values: dict[str, int] = {}
    for report_type in REPORT_MAX_TOKEN_TYPES:
        values[report_type.value] = await get_report_max_tokens_for_type(db, user_id, report_type)
    return values


async def update_report_max_tokens(db: AsyncSession, user_id: UUID, values: dict[str, int]) -> None:
    """Persist user-configured report token limits."""
    for raw_report_type, max_tokens in values.items():
        report_type = ReportType(raw_report_type)
        if report_type not in DEFAULT_REPORT_MAX_TOKENS:
            continue
        await _upsert_config(db, _report_max_tokens_key(user_id, report_type), int(max_tokens))


async def get_report_max_tokens_for_type(
    db: AsyncSession, user_id: UUID | None, report_type: ReportType
) -> int:
    """Return the output token limit for one report type."""
    default = DEFAULT_REPORT_MAX_TOKENS[report_type]
    if user_id is None:
        return default
    return int(await _config_value(db, _report_max_tokens_key(user_id, report_type), default))


def report_type_label(report_type: ReportType) -> str:
    """Return the human-readable report type label used in LLM prompts."""
    return REPORT_TYPE_LABELS[report_type]


async def _config_value(db: AsyncSession, key: str, default: Any) -> Any:
    config = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    if config is None:
        return default
    return config.value.get("value", default)


async def _upsert_config(db: AsyncSession, key: str, value: Any) -> None:
    config = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    if config is None:
        db.add(SystemConfig(key=key, value={"value": value}))
        return
    config.value = {"value": value}


def _report_max_tokens_key(user_id: UUID, report_type: ReportType) -> str:
    return f"sigma.user.{user_id}.report.max_tokens.{report_type.value}"
