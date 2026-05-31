from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, time
from typing import TYPE_CHECKING, Any

import httpx
from sqlalchemy import func, select

from app.analyzers.llm_parsing import _extract_json_object, build_prompt
from app.core.config import settings
from app.models.enums import LLMFunctionType
from app.models.llm_usage_log import LLMUsageLog
from app.models.system_config import SystemConfig
from app.services.llm_settings import get_default_api_key

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class BudgetExceededError(RuntimeError):
    """Raised when the configured daily token budget is exhausted."""


@dataclass(frozen=True)
class LLMRuntimeConfig:
    """Resolved provider/model configuration for one LLM call."""

    provider: str
    model: str
    daily_token_limit: int
    api_key: str | None = None


OPENAI_COMPATIBLE_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "qwen": "https://api.zhizengzeng.com/v1",
}

DEFAULT_PROVIDER_MODELS = {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o",
    "deepseek": "deepseek-chat",
    "qwen": "qwen3.5-397b-a17b",
}

LLM_API_MAX_TOKENS = 16_384
LLM_HTTP_TIMEOUT_SECONDS = 300
LLM_RETRY_DELAYS_SECONDS = (1, 2, 4)
LLM_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class LLMClient:
    """Unified async client for Anthropic and OpenAI-compatible chat completions."""

    def __init__(
        self,
        db: AsyncSession,
        function_type: LLMFunctionType = LLMFunctionType.SUMMARY,
        http_client: httpx.AsyncClient | None = None,
        user_id: UUID | None = None,
        provider: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.db = db
        self.function_type = function_type
        self.http_client = http_client
        self.user_id = user_id
        self.provider = provider.lower() if provider else None
        self.model = model
        self.api_key = api_key

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.3,
        context_docs: list[str] | None = None,
    ) -> str:
        """Complete a prompt through the configured LLM provider."""
        runtime = await self._runtime_config()
        await self._check_budget(runtime.daily_token_limit, max_tokens)
        prompt = build_prompt(user_prompt, context_docs)
        payload = self._payload(
            runtime.provider, runtime.model, system_prompt, prompt, LLM_API_MAX_TOKENS, temperature
        )
        headers = self._headers(runtime.provider, runtime.api_key)
        url = self._url(runtime.provider)
        response = await self._post_with_retry(url, headers, payload)
        text, input_tokens, output_tokens = self._parse_response(runtime.provider, response)
        self.db.add(
            LLMUsageLog(
                provider=runtime.provider,
                model=runtime.model,
                user_id=self.user_id,
                function_type=self.function_type,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )
        )
        await self.db.flush()
        return text

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.3,
        context_docs: list[str] | None = None,
    ) -> dict[str, Any]:
        """Complete a prompt and parse the response as a JSON object."""
        text = await self.complete(
            system_prompt, user_prompt, max_tokens, temperature, context_docs
        )
        parsed = json.loads(_extract_json_object(text))
        if not isinstance(parsed, dict):
            raise ValueError("LLM response was not a JSON object")
        return parsed

    async def _runtime_config(self) -> LLMRuntimeConfig:
        daily_limit = settings.daily_token_limit
        if self.user_id is not None:
            daily_limit = await self._config_value(
                f"sigma.user.{self.user_id}.llm.daily_token_limit",
                settings.daily_token_limit,
            )
        if self.provider is not None:
            return LLMRuntimeConfig(
                provider=self.provider,
                model=self.model
                or DEFAULT_PROVIDER_MODELS.get(self.provider, str(settings.default_llm_model)),
                daily_token_limit=int(daily_limit),
                api_key=self.api_key,
            )

        if self.user_id is not None:
            default_key = await get_default_api_key(self.db, self.user_id)
            if default_key is not None:
                provider = default_key.provider.lower()
                return LLMRuntimeConfig(
                    provider=provider,
                    model=self.model or DEFAULT_PROVIDER_MODELS[provider],
                    daily_token_limit=int(daily_limit),
                    api_key=self.api_key or default_key.key,
                )
        return LLMRuntimeConfig(
            provider=str(settings.default_llm_provider).lower(),
            model=self.model or str(settings.default_llm_model),
            daily_token_limit=int(daily_limit),
            api_key=self.api_key,
        )

    async def _config_value(self, key: str, default: Any) -> Any:
        config = await self.db.scalar(select(SystemConfig).where(SystemConfig.key == key))
        if config is None:
            return default
        if "value" in config.value:
            return config.value["value"]
        return default

    async def _check_budget(self, daily_token_limit: int, max_tokens: int) -> None:
        start = datetime.combine(datetime.now(UTC).date(), time.min, tzinfo=UTC)
        predicate = [LLMUsageLog.created_at >= start]
        if self.user_id is not None:
            predicate.append(LLMUsageLog.user_id == self.user_id)
        used = await self.db.scalar(
            select(
                func.coalesce(func.sum(LLMUsageLog.input_tokens + LLMUsageLog.output_tokens), 0)
            ).where(*predicate)
        )
        # Provider response usage fields remain the source of truth after calls. Before a call,
        # use a generous estimate because report requests no longer hard-cap provider output to
        # the user's prompt-level target.
        estimated_output_tokens = min(max_tokens * 2, LLM_API_MAX_TOKENS)
        if int(used or 0) + estimated_output_tokens > daily_token_limit:
            raise BudgetExceededError("Daily LLM token budget exceeded")

    def _headers(self, provider: str, api_key: str | None = None) -> dict[str, str]:
        if provider == "anthropic":
            return {
                "x-api-key": api_key or settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
        if provider in OPENAI_COMPATIBLE_BASE_URLS:
            return {
                "authorization": f"Bearer {api_key or self._api_key(provider)}",
                "content-type": "application/json",
            }
        raise ValueError(f"Unsupported LLM provider: {provider}")

    def _url(self, provider: str) -> str:
        if provider == "anthropic":
            return "https://api.anthropic.com/v1/messages"
        if provider in OPENAI_COMPATIBLE_BASE_URLS:
            return f"{OPENAI_COMPATIBLE_BASE_URLS[provider]}/chat/completions"
        raise ValueError(f"Unsupported LLM provider: {provider}")

    def _api_key(self, provider: str) -> str:
        if provider == "openai":
            return settings.openai_api_key
        if provider == "deepseek":
            return settings.deepseek_api_key
        if provider == "qwen":
            return settings.qwen_api_key
        raise ValueError(f"Unsupported LLM provider: {provider}")

    def _payload(
        self,
        provider: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        temperature: float,
    ) -> dict[str, Any]:
        if provider == "anthropic":
            return {
                "model": model,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
        if provider in OPENAI_COMPATIBLE_BASE_URLS:
            return {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
        raise ValueError(f"Unsupported LLM provider: {provider}")

    async def _post_with_retry(
        self,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        owns_client = self.http_client is None
        client = self.http_client or httpx.AsyncClient(timeout=LLM_HTTP_TIMEOUT_SECONDS)
        try:
            for attempt in range(len(LLM_RETRY_DELAYS_SECONDS)):
                try:
                    response = await client.post(
                        url,
                        headers=headers,
                        json=payload,
                        timeout=LLM_HTTP_TIMEOUT_SECONDS,
                    )
                    if response.status_code not in LLM_RETRYABLE_STATUS_CODES:
                        response.raise_for_status()
                        return response.json()
                except httpx.HTTPError as exc:
                    if attempt == len(LLM_RETRY_DELAYS_SECONDS) - 1:
                        logger.warning("LLM request failed after retries: %s", exc)
                        raise
                if attempt < len(LLM_RETRY_DELAYS_SECONDS) - 1:
                    await asyncio.sleep(LLM_RETRY_DELAYS_SECONDS[attempt])
            logger.warning("LLM request failed after retries with status %s", response.status_code)
            response.raise_for_status()
            return response.json()
        finally:
            if owns_client:
                await client.aclose()

    def _parse_response(self, provider: str, response: dict[str, Any]) -> tuple[str, int, int]:
        if provider == "anthropic":
            content = response.get("content", [])
            text = "".join(part.get("text", "") for part in content if part.get("type") == "text")
            usage = response.get("usage", {})
            return text, int(usage.get("input_tokens", 0)), int(usage.get("output_tokens", 0))
        if provider in OPENAI_COMPATIBLE_BASE_URLS:
            choices = response.get("choices", [])
            text = str(choices[0]["message"]["content"]) if choices else ""
            usage = response.get("usage", {})
            return text, int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0))
        raise ValueError(f"Unsupported LLM provider: {provider}")
