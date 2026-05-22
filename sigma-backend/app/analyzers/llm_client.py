from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, time, timezone
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import LLMFunctionType
from app.models.llm_usage_log import LLMUsageLog
from app.models.system_config import SystemConfig

logger = logging.getLogger(__name__)


class BudgetExceededError(RuntimeError):
    """Raised when the configured daily token budget is exhausted."""


@dataclass(frozen=True)
class LLMRuntimeConfig:
    """Resolved provider/model configuration for one LLM call."""

    provider: str
    model: str
    daily_token_limit: int


OPENAI_COMPATIBLE_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "minimax": "https://api.minimax.io/v1",
    "kimi": "https://api.moonshot.cn/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
}


class LLMClient:
    """Unified async client for Anthropic and OpenAI-compatible chat completions."""

    def __init__(
        self,
        db: AsyncSession,
        function_type: LLMFunctionType = LLMFunctionType.SUMMARY,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.db = db
        self.function_type = function_type
        self.http_client = http_client

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
        payload = self._payload(runtime.provider, runtime.model, system_prompt, prompt, max_tokens, temperature)
        headers = self._headers(runtime.provider)
        url = self._url(runtime.provider)
        response = await self._post_with_retry(url, headers, payload)
        text, input_tokens, output_tokens = self._parse_response(runtime.provider, response)
        self.db.add(
            LLMUsageLog(
                provider=runtime.provider,
                model=runtime.model,
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
        text = await self.complete(system_prompt, user_prompt, max_tokens, temperature, context_docs)
        parsed = json.loads(_extract_json_object(text))
        if not isinstance(parsed, dict):
            raise ValueError("LLM response was not a JSON object")
        return parsed

    async def _runtime_config(self) -> LLMRuntimeConfig:
        provider = await self._config_value("sigma.llm.provider", settings.default_llm_provider)
        model = await self._config_value("sigma.llm.model", settings.default_llm_model)
        daily_limit = await self._config_value("sigma.llm.daily_token_limit", settings.daily_token_limit)
        return LLMRuntimeConfig(
            provider=str(provider).lower(),
            model=str(model),
            daily_token_limit=int(daily_limit),
        )

    async def _config_value(self, key: str, default: object) -> object:
        config = await self.db.scalar(select(SystemConfig).where(SystemConfig.key == key))
        if config is None:
            return default
        if "value" in config.value:
            return config.value["value"]
        return default

    async def _check_budget(self, daily_token_limit: int, max_tokens: int) -> None:
        start = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)
        used = await self.db.scalar(
            select(func.coalesce(func.sum(LLMUsageLog.input_tokens + LLMUsageLog.output_tokens), 0)).where(
                LLMUsageLog.created_at >= start
            )
        )
        if int(used or 0) + max_tokens > daily_token_limit:
            raise BudgetExceededError("Daily LLM token budget exceeded")

    def _headers(self, provider: str) -> dict[str, str]:
        if provider == "anthropic":
            return {
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
        if provider in OPENAI_COMPATIBLE_BASE_URLS:
            return {
                "authorization": f"Bearer {self._api_key(provider)}",
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
        if provider == "minimax":
            return settings.minimax_api_key
        if provider == "kimi":
            return settings.kimi_api_key
        if provider == "gemini":
            return settings.gemini_api_key
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
        delays = (1, 2, 4)
        owns_client = self.http_client is None
        client = self.http_client or httpx.AsyncClient(timeout=60)
        try:
            for attempt in range(3):
                try:
                    response = await client.post(url, headers=headers, json=payload, timeout=60)
                    if response.status_code not in {429, 500, 502, 503, 504}:
                        response.raise_for_status()
                        return response.json()
                except httpx.HTTPError as exc:
                    if attempt == 2:
                        logger.warning("LLM request failed after retries: %s", exc)
                        raise
                if attempt < 2:
                    await asyncio.sleep(delays[attempt])
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


def build_prompt(prompt: str, context_docs: list[str] | None = None) -> str:
    """Build a prompt with optional RAG reference documents."""
    if not context_docs:
        return prompt
    references = "\n\n".join(context_docs)
    return f"Reference documents:\n{references}\n\nContent:\n{prompt}"


def _extract_json_object(text: str) -> str:
    """Extract a JSON object from plain or fenced model output."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return stripped
    return stripped[start : end + 1]
