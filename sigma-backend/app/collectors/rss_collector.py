from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import html
import re
from typing import Any

import feedparser
import httpx

from app.collectors.base import DEFAULT_USER_AGENT, BaseCollector, RawCollectedItem


class RSSCollector(BaseCollector):
    """Collect items from RSS or Atom feeds."""

    async def validate_config(self) -> bool:
        """Validate required RSS collector configuration."""
        return bool(self.config.get("feed_url"))

    async def collect(self) -> list[RawCollectedItem]:
        """Fetch and parse feed entries."""
        if not await self.validate_config():
            return []

        if self._client is not None:
            return await self._collect_with_client(self._client)

        async with httpx.AsyncClient(timeout=30) as client:
            return await self._collect_with_client(client)

    async def _collect_with_client(self, client: httpx.AsyncClient) -> list[RawCollectedItem]:
        headers = {"User-Agent": str(self.config.get("user_agent") or DEFAULT_USER_AGENT)}
        response = await client.get(str(self.config["feed_url"]), headers=headers)
        response.raise_for_status()
        feed = feedparser.parse(response.text)
        max_entries = int(self.config.get("max_entries", 20))
        items: list[RawCollectedItem] = []
        for entry in feed.entries[:max_entries]:
            published = self._parse_published(entry.get("published") or entry.get("updated"))
            content = self._entry_content(entry)
            items.append(
                {
                    "title": self._clean_text(entry.get("title", "")),
                    "content": content,
                    "summary": self._clean_text(entry.get("summary", "")) or None,
                    "content_url": entry.get("link"),
                    "published_at": published.isoformat(),
                    "metadata": {"source_format": "rss"},
                }
            )
        return items

    @staticmethod
    def _parse_published(value: str | None) -> datetime:
        if not value:
            return datetime.now(timezone.utc)
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return datetime.now(timezone.utc)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed

    @classmethod
    def _entry_content(cls, entry: Any) -> str:
        content = entry.get("summary", "")
        content_entries = entry.get("content") or []
        if content_entries:
            first = content_entries[0]
            if isinstance(first, dict):
                content = first.get("value") or content
            else:
                content = getattr(first, "value", content)
        return cls._clean_text(content)

    @staticmethod
    def _clean_text(value: object) -> str:
        text = html.unescape(str(value or ""))
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()
