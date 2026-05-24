import asyncio
from itertools import cycle
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.collectors.base import BaseCollector, RawCollectedItem
from app.collectors.utils import parse_datetime

USER_AGENTS = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
)
_USER_AGENT_POOL = cycle(USER_AGENTS)


class ScraperCollector(BaseCollector):
    """Collect items from HTML pages with CSS selectors."""

    async def validate_config(self) -> bool:
        """Validate required scraper collector configuration."""
        selectors = self.config.get("selectors") or {}
        return bool(self.config.get("target_url") and selectors.get("item_container"))

    async def collect(self) -> list[RawCollectedItem]:
        """Fetch HTML and extract selected items."""
        if not await self.validate_config():
            return []
        delay = float(self.config.get("request_interval_sec", 0))
        if delay > 0:
            await asyncio.sleep(delay)

        if self._client is not None:
            return await self._collect_with_client(self._client)

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            return await self._collect_with_client(client)

    async def _collect_with_client(self, client: httpx.AsyncClient) -> list[RawCollectedItem]:
        headers = {"User-Agent": self._user_agent()}
        target_url = str(self.config["target_url"])
        response = await client.get(target_url, headers=headers)
        response.raise_for_status()
        selectors = self.config["selectors"]
        soup = BeautifulSoup(response.text, "html.parser")
        items: list[RawCollectedItem] = []
        max_entries = int(self.config.get("max_entries") or 0)
        min_content_length = int(self.config.get("min_content_length") or 30)
        for container in soup.select(str(selectors["item_container"])):
            title = self._text(container, selectors.get("title"))
            content = self._text(container, selectors.get("content")) or title
            href = self._href(container, selectors.get("link"))
            published = parse_datetime(self._text(container, selectors.get("date")))
            combined_length = len(f"{title} {content}".strip())
            if title and content and combined_length >= min_content_length:
                items.append(
                    {
                        "title": title,
                        "content": content,
                        "content_url": urljoin(target_url, href) if href else None,
                        "published_at": published.isoformat(),
                        "metadata": {"source_format": "html"},
                    }
                )
                if max_entries > 0 and len(items) >= max_entries:
                    break
        return items

    def _user_agent(self) -> str:
        if not self.config.get("user_agent_rotate", False):
            return USER_AGENTS[0]
        return next(_USER_AGENT_POOL)

    @staticmethod
    def _text(container: BeautifulSoup, selector: object) -> str:
        if not selector:
            return ""
        element = container.select_one(str(selector))
        return element.get_text(" ", strip=True) if element else ""

    @staticmethod
    def _href(container: BeautifulSoup, selector: object) -> str | None:
        if not selector:
            return None
        element = container.select_one(str(selector))
        if element is None:
            return None
        href = element.get("href")
        return str(href) if href else None
