import json
from uuid import UUID

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.llm_client import BudgetExceededError, LLMClient
from app.core.config import settings
from app.models.enums import LLMFunctionType
from app.models.llm_usage_log import LLMUsageLog
from app.models.system_config import SystemConfig


@pytest.mark.asyncio
async def test_llm_client_retries_and_tracks_usage(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Anthropic calls retry 429 responses and persist token usage."""
    calls = 0

    async def no_sleep(_delay: int) -> None:
        return None

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(
            200,
            json={
                "content": [{"type": "text", "text": "LLM summary"}],
                "usage": {"input_tokens": 12, "output_tokens": 8},
            },
        )

    monkeypatch.setattr("app.analyzers.llm_client.asyncio.sleep", no_sleep)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        client = LLMClient(db_session, http_client=http_client)
        result = await client.complete("system", "user", max_tokens=20)

    usage = await db_session.scalar(select(LLMUsageLog))
    assert result == "LLM summary"
    assert calls == 2
    assert usage is not None
    assert usage.input_tokens == 12
    assert usage.output_tokens == 8


@pytest.mark.asyncio
async def test_llm_client_openai_complete_json(db_session: AsyncSession) -> None:
    """OpenAI chat responses can be parsed as JSON."""
    user_id = UUID("22222222-2222-2222-2222-222222222222")
    db_session.add(
        SystemConfig(
            key=f"sigma.user.{user_id}.llm.api_keys",
            value={
                "value": [
                    {
                        "name": "OpenAI",
                        "key": "sk-openai-test",
                        "provider": "openai",
                        "token_limit": 1000,
                        "is_default": True,
                    }
                ]
            },
        )
    )
    await db_session.commit()

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert request.headers["authorization"] == "Bearer sk-openai-test"
        assert payload["model"] == "gpt-4o"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "{\"ok\": true}"}}],
                "usage": {"prompt_tokens": 5, "completion_tokens": 2},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        client = LLMClient(db_session, LLMFunctionType.REPORT, http_client=http_client, user_id=user_id)
        result = await client.complete_json("system", "user", max_tokens=20)

    usage = await db_session.scalar(select(LLMUsageLog))
    assert result == {"ok": True}
    assert usage is not None
    assert usage.user_id == user_id


@pytest.mark.asyncio
async def test_llm_client_budget_exceeded(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    """Daily budget guard prevents calls that would exceed the token limit."""
    monkeypatch.setattr(settings, "daily_token_limit", 10)
    db_session.add(
        LLMUsageLog(
            provider="anthropic",
            model="claude-test",
            function_type=LLMFunctionType.SUMMARY,
            input_tokens=8,
            output_tokens=1,
        )
    )
    await db_session.commit()

    client = LLMClient(db_session)

    with pytest.raises(BudgetExceededError):
        await client.complete("system", "user", max_tokens=2)
