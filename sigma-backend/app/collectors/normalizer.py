from datetime import UTC, datetime, timedelta

from app.collectors.base import RawCollectedItem
from app.collectors.utils import clean_text, parse_datetime
from app.core.config import settings
from app.models.data_source import DataSource
from app.schemas.item import CollectedItemCreate


def normalize_items(
    source: DataSource, raw_items: list[RawCollectedItem]
) -> list[CollectedItemCreate]:
    """Normalize collector output for database insertion."""
    normalized: list[CollectedItemCreate] = []
    creator = source.__dict__.get("creator")
    retention_days = (
        getattr(creator, "data_retention_days", None) or settings.default_retention_days
    )
    expires_at = datetime.now(UTC) + timedelta(days=retention_days)
    cutoff = datetime.now(UTC) - timedelta(days=30)
    for raw in raw_items:
        title = clean_text(raw.get("title") or "")
        content_raw = clean_text(
            raw.get("content_raw") or raw.get("content") or raw.get("summary") or ""
        )
        if not title or not content_raw:
            continue
        published_at = parse_datetime(raw.get("published_at"))
        if published_at < cutoff:
            continue
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


def _metadata(raw: RawCollectedItem) -> dict[str, object] | None:
    metadata = raw.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return None
