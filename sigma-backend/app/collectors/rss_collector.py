from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import feedparser
import httpx

from app.collectors.base import BaseCollector, RawCollectedItem


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
        response = await client.get(str(self.config["feed_url"]))
        response.raise_for_status()
        feed = feedparser.parse(response.text)
        max_entries = int(self.config.get("max_entries", 20))
        items: list[RawCollectedItem] = []
        for entry in feed.entries[:max_entries]:
            published = self._parse_published(entry.get("published") or entry.get("updated"))
            items.append(
                {
                    "title": str(entry.get("title", "")),
                    "content": str(entry.get("summary", "")),
                    "summary": str(entry.get("summary", "")) or None,
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
