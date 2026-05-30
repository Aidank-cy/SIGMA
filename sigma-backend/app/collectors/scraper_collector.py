import asyncio
import re
from itertools import cycle
from typing import Any
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
        has_url = bool(self.config.get("target_url") or self.config.get("url"))
        selectors = self.config.get("selectors") or {}
        has_selector = bool(selectors.get("item_container") or self.config.get("item_selector"))
        return has_url and has_selector

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
        target_url = str(self.config.get("target_url") or self.config.get("url", ""))
        selectors = dict(self.config.get("selectors") or {})
        if not selectors.get("item_container") and self.config.get("item_selector"):
            selectors["item_container"] = self.config["item_selector"]
        if not selectors.get("title"):
            selectors["title"] = "h2, h3, a"
        if not selectors.get("content"):
            selectors["content"] = "p"
        if not selectors.get("link"):
            selectors["link"] = "a"
        response = await client.get(target_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        items: list[RawCollectedItem] = []
        max_entries = int(self.config.get("max_entries") or 0)
        min_content_length = int(self.config.get("min_content_length") or 30)
        request_interval = float(self.config.get("request_interval_sec", 0))
        follow_link = bool(self.config.get("follow_link", False))
        article_selector = str(
            self.config.get("article_content_selector")
            or "article p, .article-body p, .story-body p"
        )
        for container in soup.select(str(selectors["item_container"])):
            title = self._clean_title(
                self._text(container, selectors.get("title")) or self._container_text(container)
            )
            content = self._text(container, selectors.get("content")) or title
            href = self._href(container, selectors.get("link"))
            content_url = urljoin(target_url, href) if href else None
            if self._content_matches_title(content, title):
                content = (
                    self._richer_content(container, selectors.get("content"), title) or content
                )
            if follow_link and content_url and self._content_matches_title(content, title):
                if request_interval > 0:
                    await asyncio.sleep(request_interval)
                content = (
                    await self._linked_article_content(
                        client,
                        content_url,
                        headers,
                        article_selector,
                    )
                    or content
                )
            published = parse_datetime(self._text(container, selectors.get("date")))
            combined_length = len(f"{title} {content}".strip())
            if title and content and combined_length >= min_content_length:
                items.append(
                    {
                        "title": title,
                        "content": content,
                        "content_url": content_url,
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
    def _clean_title(text: str) -> str:
        """Remove trailing standalone numbers such as comment or share counts."""
        return re.sub(r"\s+\d+\s*$", "", text).strip()

    @staticmethod
    def _text(container: BeautifulSoup, selector: Any) -> str:
        if not selector:
            return ""
        element = container.select_one(str(selector))
        return element.get_text(" ", strip=True) if element else ""

    @staticmethod
    def _richer_content(container: BeautifulSoup, selector: Any, title: str) -> str:
        content_parts: list[str] = []
        for element in container.select(str(selector or "p")):
            part = element.get_text(" ", strip=True)
            if part and not ScraperCollector._content_matches_title(part, title):
                content_parts.append(part)
        if content_parts:
            return " ".join(content_parts)

        container_text = ScraperCollector._container_text(container)
        if container_text.startswith(title):
            return re.sub(r"^\s*\d+\s*", "", container_text[len(title) :]).strip()
        return re.sub(r"^\s*\d+\s*", "", container_text.replace(title, "", 1)).strip()

    @staticmethod
    def _container_text(container: BeautifulSoup) -> str:
        return container.get_text(" ", strip=True)

    @staticmethod
    def _href(container: BeautifulSoup, selector: Any) -> str | None:
        if not selector:
            return None
        element = container.select_one(str(selector))
        if element is None:
            return None
        href = element.get("href")
        return str(href) if href else None

    @staticmethod
    def _content_matches_title(content: str, title: str) -> bool:
        content_text = content.strip()
        title_text = title.strip()
        return bool(
            content_text
            and title_text
            and (content_text == title_text or content_text in title_text)
        )

    @staticmethod
    async def _linked_article_content(
        client: httpx.AsyncClient,
        url: str,
        headers: dict[str, str],
        selector: str,
    ) -> str:
        try:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
        except httpx.HTTPError:
            return ""
        soup = BeautifulSoup(response.text, "html.parser")
        parts = [
            element.get_text(" ", strip=True)
            for element in soup.select(selector)
            if element.get_text(" ", strip=True)
        ]
        return " ".join(parts)[:2000].strip()
