from abc import ABC, abstractmethod
from typing import Any, TypedDict

import httpx

from app.models.data_source import DataSource

DEFAULT_USER_AGENT = "SIGMACollector/1.0"
DEFAULT_HTTP_TIMEOUT_SECONDS = 30


class RawCollectedItem(TypedDict, total=False):
    """Collector output before normalization."""

    title: str
    content: str
    content_raw: str
    summary: str | None
    url: str | None
    content_url: str | None
    published_at: str
    metadata: dict[str, Any]


class BaseCollector(ABC):
    """Base class for all source collectors."""

    def __init__(self, source: DataSource, client: httpx.AsyncClient | None = None) -> None:
        self.source = source
        self.config = source.config or {}
        self._client = client

    async def collect(self) -> list[RawCollectedItem]:
        """Collect raw items from the configured source."""
        if not await self.validate_config():
            return []
        await self._before_collect()
        if self._client is not None:
            return await self._do_collect(self._client)
        async with httpx.AsyncClient(
            timeout=DEFAULT_HTTP_TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as client:
            return await self._do_collect(client)

    @abstractmethod
    async def validate_config(self) -> bool:
        """Return whether the source configuration is usable."""

    async def _before_collect(self) -> None:
        """Run optional setup before the HTTP client is used."""
        return None

    @abstractmethod
    async def _do_collect(self, client: httpx.AsyncClient) -> list[RawCollectedItem]:
        """Collect raw items using the provided HTTP client."""
