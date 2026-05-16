from datetime import datetime, timedelta, timezone
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
        try:
            normalized = value.replace("Z", "+00:00")
            if normalized.isdigit():
                parsed = datetime.fromtimestamp(int(normalized), tz=timezone.utc)
            else:
                parsed = datetime.fromisoformat(normalized)
        except ValueError:
            parsed = datetime.now(timezone.utc)
    else:
        parsed = datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _metadata(raw: RawCollectedItem) -> dict[str, object] | None:
    metadata = raw.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return None
