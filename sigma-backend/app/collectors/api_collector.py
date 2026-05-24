import asyncio
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
        has_endpoint = bool(self.config.get("endpoint") or self.config.get("base_url"))
        return has_endpoint

    async def collect(self) -> list[RawCollectedItem]:
        """Fetch and map API response items."""
        if not await self.validate_config():
            return []

        if self._client is not None:
            return await self._collect_with_client(self._client)

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            return await self._collect_with_client(client)

    async def _collect_with_client(self, client: httpx.AsyncClient) -> list[RawCollectedItem]:
        endpoint = str(self.config.get("endpoint", ""))
        base_url = self.config.get("base_url")
        url = (
            urljoin(str(base_url).rstrip("/") + "/", endpoint.lstrip("/"))
            if base_url
            else endpoint
        )
        method = str(self.config.get("method", "GET")).upper()
        base_params = self._resolve_env_values(dict(self.config.get("params") or {}))
        headers = self._resolve_env_values(dict(self.config.get("headers") or {}))
        headers.setdefault("User-Agent", str(self.config.get("user_agent") or DEFAULT_USER_AGENT))
        pagination = self.config.get("pagination") or {}
        max_pages = int(pagination.get("max_pages", 1))
        page_param = pagination.get("param", "page")
        page_start = int(pagination.get("start", 1))
        max_entries = int(self.config.get("max_entries") or 0)

        collected: list[RawCollectedItem] = []
        for page_index in range(max_pages):
            params = dict(base_params)
            if pagination:
                params[str(page_param)] = page_start + page_index
            request_kwargs: dict[str, Any] = {"headers": headers}
            if params:
                request_kwargs["params"] = params
            response = await self._request_with_rate_limit_backoff(client, method, url, request_kwargs)
            response.raise_for_status()
            payload = response.json()
            response_path = self.config.get("response_path") or self.config.get("items_path")
            entries = self._extract_entries(self._extract_path(payload, response_path))
            if not entries:
                break
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                item = self._map_entry(entry)
                if item is None:
                    continue
                collected.append(item)
                if max_entries > 0 and len(collected) >= max_entries:
                    return collected
        return collected

    def _map_entry(self, entry: dict[str, Any]) -> RawCollectedItem | None:
        mapping = dict(self.config.get("field_mapping") or {})
        if not mapping:
            mapping = self._default_field_mapping(entry)
        item: RawCollectedItem = {}
        for target, source_path in mapping.items():
            if source_path in (None, ""):
                continue
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
            title = item.get("title", "")
            link = self._extract_path(entry, "link")
            press_release = self._extract_path(entry, "press_release")
            release_id = self._extract_path(entry, "release_id")
            realtime_start = self._extract_path(entry, "realtime_start") or self._extract_path(entry, "date")
            realtime_end = self._extract_path(entry, "realtime_end")
            parts = [title]
            if realtime_start:
                release_date = f"Release date: {realtime_start}"
                if realtime_end and realtime_end != realtime_start:
                    release_date += f" to {realtime_end}"
                parts.append(release_date)
            if press_release:
                parts.append("This release includes a press release")
            if release_id and not link:
                link = f"https://fred.stlouisfed.org/release?rid={release_id}"
            if link:
                parts.append(f"Source: {link}")
                item.setdefault("content_url", str(link))
            enriched = ". ".join(part for part in parts if part)
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
        min_title_length = int(self.config.get("min_title_length") or 0)
        title = item.get("title") or ""
        if min_title_length > 0 and len(str(title).strip()) < min_title_length:
            return None
        min_content_length = int(self.config.get("min_content_length") or 0)
        content = item.get("content") or item.get("content_raw") or item.get("summary") or ""
        if min_content_length > 0 and len(str(content).strip()) < min_content_length:
            return None
        return item

    @staticmethod
    def _default_field_mapping(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "title": "title",
            "content": next((key for key in ("description", "content", "summary", "body") if key in entry), "title"),
            "content_url": next((key for key in ("link", "url", "source_url") if key in entry), ""),
            "published_at": next(
                (key for key in ("pubDate", "published_at", "publishedAt", "date", "created_at") if key in entry),
                "",
            ),
        }

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
        if isinstance(path, (list, tuple)):
            for candidate in path:
                value = APICollector._extract_path(payload, candidate)
                if value not in (None, ""):
                    return value
            return None
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
    async def _request_with_rate_limit_backoff(
        client: httpx.AsyncClient,
        method: str,
        url: str,
        request_kwargs: dict[str, Any],
    ) -> httpx.Response:
        response = await client.request(method, url, **request_kwargs)
        for attempt in range(2):
            if response.status_code != 429:
                return response
            retry_after = APICollector._retry_after_seconds(response.headers.get("Retry-After"))
            await asyncio.sleep(min(retry_after * (2**attempt), 120))
            response = await client.request(method, url, **request_kwargs)
        return response

    @staticmethod
    def _retry_after_seconds(value: str | None) -> int:
        if value is None:
            return 60
        try:
            return max(0, int(value))
        except ValueError:
            return 60

    @staticmethod
    def _resolve_env_values(values: dict[str, Any]) -> dict[str, Any]:
        resolved: dict[str, Any] = {}
        for key, value in values.items():
            if isinstance(value, str) and value.startswith("$ENV:"):
                resolved[key] = os.getenv(value.removeprefix("$ENV:"), "")
            else:
                resolved[key] = value
        return resolved
