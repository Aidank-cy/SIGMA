"""Shared text and datetime utilities for all collectors and the normalizer."""

import html
import re
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

MAX_TEXT_LENGTH = 50_000


def clean_text(value: Any, max_length: int = MAX_TEXT_LENGTH) -> str:
    """Strip HTML tags, decode entities, collapse whitespace, and truncate."""
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_length]


def parse_datetime(value: Any) -> datetime:
    """Parse common datetime formats into a UTC-aware datetime."""
    if isinstance(value, datetime):
        return _ensure_utc(value)
    if isinstance(value, int | float):
        return _from_timestamp(float(value))
    if isinstance(value, str) and value.strip():
        return _parse_string(value.strip())
    return datetime.now(UTC)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _from_timestamp(ts: float) -> datetime:
    if ts > 1e13:
        ts /= 1e9
    elif ts > 1e10:
        ts /= 1e3
    return datetime.fromtimestamp(ts, tz=UTC)


def _parse_string(value: str) -> datetime:
    if value.isdigit():
        return _from_timestamp(int(value))

    parsers = (
        lambda candidate: datetime.fromisoformat(candidate.replace("Z", "+00:00")),
        lambda candidate: datetime.strptime(candidate, "%Y-%m-%d"),
        lambda candidate: datetime.strptime(candidate, "%Y/%m/%d %H:%M:%S"),
        lambda candidate: datetime.strptime(candidate, "%m/%d/%Y"),
        lambda candidate: datetime.strptime(candidate, "%Y%m%dT%H%M%S"),
        lambda candidate: datetime.strptime(candidate, "%Y%m%dT%H%M"),
        lambda candidate: datetime.strptime(candidate, "%B %d, %Y"),
        lambda candidate: datetime.strptime(candidate, "%b %d, %Y"),
        lambda candidate: datetime.strptime(candidate, "%d %b %Y"),
        lambda candidate: datetime.strptime(candidate, "%d %B %Y"),
        parsedate_to_datetime,
    )
    for parser in parsers:
        try:
            return _ensure_utc(parser(value))
        except (TypeError, ValueError):
            continue
    return datetime.now(UTC)
