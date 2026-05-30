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

    @abstractmethod
    async def collect(self) -> list[RawCollectedItem]:
        """Collect raw items from the configured source."""

    @abstractmethod
    async def validate_config(self) -> bool:
        """Return whether the source configuration is usable."""

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        return httpx.AsyncClient(timeout=DEFAULT_HTTP_TIMEOUT_SECONDS)
