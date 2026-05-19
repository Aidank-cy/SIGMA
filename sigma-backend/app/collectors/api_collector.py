import os
from typing import Any
from urllib.parse import urljoin

import httpx

from app.collectors.base import DEFAULT_USER_AGENT, BaseCollector, RawCollectedItem


class APICollector(BaseCollector):
    """Collect items from JSON HTTP APIs."""

    async def validate_config(self) -> bool:
        """Validate required API collector configuration."""
        return bool(self.config.get("base_url") and self.config.get("field_mapping"))

    async def collect(self) -> list[RawCollectedItem]:
        """Fetch and map API response items."""
        if not await self.validate_config():
            return []

        if self._client is not None:
            return await self._collect_with_client(self._client)

        async with httpx.AsyncClient(timeout=30) as client:
            return await self._collect_with_client(client)

    async def _collect_with_client(self, client: httpx.AsyncClient) -> list[RawCollectedItem]:
        endpoint = str(self.config.get("endpoint", ""))
        url = urljoin(str(self.config["base_url"]).rstrip("/") + "/", endpoint.lstrip("/"))
        method = str(self.config.get("method", "GET")).upper()
        base_params = self._resolve_env_values(dict(self.config.get("params") or {}))
        headers = self._resolve_env_values(dict(self.config.get("headers") or {}))
        headers.setdefault("User-Agent", str(self.config.get("user_agent") or DEFAULT_USER_AGENT))
        pagination = self.config.get("pagination") or {}
        max_pages = int(pagination.get("max_pages", 1))
        page_param = pagination.get("param", "page")
        page_start = int(pagination.get("start", 1))

        collected: list[RawCollectedItem] = []
        for page_index in range(max_pages):
            params = dict(base_params)
            if pagination:
                params[str(page_param)] = page_start + page_index
            response = await client.request(method, url, headers=headers, params=params)
            response.raise_for_status()
            payload = response.json()
            entries = self._extract_path(payload, self.config.get("response_path"))
            if isinstance(entries, dict):
                entries = [entries]
            if not isinstance(entries, list) or not entries:
                break
            collected.extend(self._map_entry(entry) for entry in entries if isinstance(entry, dict))
        return collected

    def _map_entry(self, entry: dict[str, Any]) -> RawCollectedItem:
        mapping = dict(self.config.get("field_mapping") or {})
        item: RawCollectedItem = {}
        for target, source_path in mapping.items():
            value = self._extract_path(entry, source_path)
            if value is not None:
                item[target] = str(value)
        metadata_fields = self.config.get("metadata_fields") or []
        metadata = {
            str(field): self._extract_path(entry, field)
            for field in metadata_fields
            if self._extract_path(entry, field) is not None
        }
        if metadata:
            item["metadata"] = metadata
        return item

    @staticmethod
    def _extract_path(payload: Any, path: Any) -> Any:
        if path in (None, ""):
            return payload
        value = payload
        for part in str(path).split("."):
            if isinstance(value, dict):
                value = value.get(part)
            elif isinstance(value, list) and part.isdigit():
                value = value[int(part)]
            else:
                return None
            if value is None:
                return None
        return value

    @staticmethod
    def _resolve_env_values(values: dict[str, Any]) -> dict[str, Any]:
        resolved: dict[str, Any] = {}
        for key, value in values.items():
            if isinstance(value, str) and value.startswith("$ENV:"):
                resolved[key] = os.getenv(value.removeprefix("$ENV:"), "")
            else:
                resolved[key] = value
        return resolved
