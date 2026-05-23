import os
from typing import Any
from urllib.parse import urljoin

import httpx

from app.collectors.base import DEFAULT_USER_AGENT, BaseCollector, RawCollectedItem
from app.collectors.utils import clean_text, parse_datetime


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
            entries = self._extract_entries(self._extract_path(payload, self.config.get("response_path")))
            if not entries:
                break
            collected.extend(self._map_entry(entry) for entry in entries if isinstance(entry, dict))
        return collected

    def _map_entry(self, entry: dict[str, Any]) -> RawCollectedItem:
        mapping = dict(self.config.get("field_mapping") or {})
        item: RawCollectedItem = {}
        for target, source_path in mapping.items():
            value = self._extract_path(entry, source_path)
            value = self._coerce_value(value)
            if value is None:
                continue
            if target == "published_at":
                item[target] = parse_datetime(value).isoformat()
            elif target in {"title", "content", "content_raw", "summary"}:
                item[target] = clean_text(value)
            else:
                item[target] = str(value)
        if not item.get("content") and not item.get("content_raw"):
            title = item.get("title")
            if title:
                item["content"] = title
        if item.get("content") == item.get("title") or item.get("content_raw") == item.get("title"):
            extra_parts = []
            for field in ("press_release", "link", "notes", "realtime_start", "realtime_end"):
                value = self._extract_path(entry, field)
                value_text = str(value).strip() if value is not None else ""
                if value_text and value_text != item.get("title", ""):
                    extra_parts.append(f"{field}: {value_text}")
            if extra_parts:
                enriched = f"{item.get('title', '')}. {'; '.join(extra_parts)}"
                item["content"] = enriched
                if "content_raw" in item:
                    item["content_raw"] = enriched
        metadata_fields = self.config.get("metadata_fields") or []
        metadata = {
            str(field): self._extract_path(entry, field)
            for field in metadata_fields
            if self._extract_path(entry, field) is not None
        }
        if metadata:
            item["metadata"] = metadata
        return item

    @classmethod
    def _extract_entries(cls, value: Any) -> list[dict[str, Any]]:
        if isinstance(value, list):
            return [entry for entry in value if isinstance(entry, dict)]
        if isinstance(value, dict):
            for key in ("data", "results", "articles", "items", "records", "news", "releases"):
                nested = value.get(key)
                nested_entries = cls._extract_entries(nested)
                if nested_entries:
                    return nested_entries
            return [value]
        return []

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

    @classmethod
    def _coerce_value(cls, value: Any) -> Any:
        if isinstance(value, list):
            for item in value:
                coerced = cls._coerce_value(item)
                if coerced not in (None, ""):
                    return coerced
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
