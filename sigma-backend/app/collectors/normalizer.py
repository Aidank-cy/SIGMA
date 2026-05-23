from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import html
import re
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
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    for raw in raw_items:
        title = _clean_text(raw.get("title") or "")
        content_raw = _clean_text(raw.get("content_raw") or raw.get("content") or raw.get("summary") or "")
        if not title or not content_raw:
            continue
        published_at = _parse_datetime(raw.get("published_at"))
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


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, int | float):
        timestamp = float(value)
        if timestamp > 10_000_000_000:
            timestamp /= 1000
        parsed = datetime.fromtimestamp(timestamp, tz=timezone.utc)
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
        timestamp = int(normalized)
        if timestamp > 10_000_000_000:
            timestamp /= 1000
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    parsers = (
        lambda candidate: datetime.fromisoformat(candidate.replace("Z", "+00:00")),
        lambda candidate: datetime.strptime(candidate, "%Y%m%dT%H%M%S"),
        lambda candidate: datetime.strptime(candidate, "%Y%m%dT%H%M"),
        lambda candidate: datetime.strptime(candidate, "%Y-%m-%d"),
        lambda candidate: datetime.strptime(candidate, "%Y/%m/%d %H:%M:%S"),
        lambda candidate: datetime.strptime(candidate, "%d %b %Y"),
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


def _clean_text(value: Any) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:50_000]


def _metadata(raw: RawCollectedItem) -> dict[str, object] | None:
    metadata = raw.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return None
