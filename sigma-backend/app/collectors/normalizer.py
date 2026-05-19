from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

from app.collectors.base import RawCollectedItem
from app.core.config import settings
from app.models.data_source import DataSource
from app.schemas.item import CollectedItemCreate


def normalize_items(source: DataSource, raw_items: list[RawCollectedItem]) -> list[CollectedItemCreate]:
    """Normalize collector output for database insertion."""
    normalized: list[CollectedItemCreate] = []
    creator = source.__dict__.get("creator")
    retention_days = getattr(creator, "data_retention_days", None) or settings.default_retention_days
    expires_at = datetime.now(timezone.utc) + timedelta(days=retention_days)
    for raw in raw_items:
        title = str(raw.get("title") or "").strip()
        content_raw = str(raw.get("content_raw") or raw.get("content") or raw.get("summary") or "").strip()
        if not title or not content_raw:
            continue
        published_at = _parse_datetime(raw.get("published_at"))
        normalized.append(
            CollectedItemCreate(
                source_id=source.id,
                title=title[:500],
                content_raw=content_raw,
                content_url=raw.get("content_url") or raw.get("url"),
                summary=raw.get("summary"),
                category=source.category.value,
                market=source.market.value,
                published_at=published_at,
                expires_at=expires_at,
                metadata_extra=_metadata(raw),
            )
        )
    return normalized


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, int | float):
        parsed = datetime.fromtimestamp(value, tz=timezone.utc)
    elif isinstance(value, str) and value:
        parsed = _parse_datetime_string(value)
    else:
        parsed = datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _parse_datetime_string(value: str) -> datetime:
    normalized = value.strip()
    if normalized.isdigit():
        return datetime.fromtimestamp(int(normalized), tz=timezone.utc)

    parsers = (
        lambda candidate: datetime.fromisoformat(candidate.replace("Z", "+00:00")),
        lambda candidate: datetime.strptime(candidate, "%Y%m%dT%H%M%S"),
        lambda candidate: datetime.strptime(candidate, "%Y%m%dT%H%M"),
        lambda candidate: datetime.strptime(candidate, "%B %d, %Y"),
        lambda candidate: datetime.strptime(candidate, "%b %d, %Y"),
        parsedate_to_datetime,
    )
    for parser in parsers:
        try:
            return parser(normalized)
        except (TypeError, ValueError):
            continue
    return datetime.now(timezone.utc)


def _metadata(raw: RawCollectedItem) -> dict[str, object] | None:
    metadata = raw.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return None
