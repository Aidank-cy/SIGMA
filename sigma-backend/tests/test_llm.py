from uuid import UUID

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.llm_client import BudgetExceededError, LLMClient, _extract_json_object
from app.core.config import settings
from app.models.enums import LLMFunctionType
from app.models.llm_usage_log import LLMUsageLog
from app.models.system_config import SystemConfig
from app.services.llm import build_prompt


def test_build_prompt_injects_context_docs() -> None:
    """Context documents are injected before prompt content."""
    prompt = build_prompt("Summarize this.", context_docs=["Doc A", "Doc B"])

    assert prompt.startswith("Reference documents:")
    assert "Doc A" in prompt
    assert "Content:\nSummarize this." in prompt


def test_build_prompt_without_context_returns_prompt() -> None:
    """Prompts without context are not wrapped."""
    assert build_prompt("Summarize this.") == "Summarize this."


def test_extract_json_object_from_fenced_model_output() -> None:
    """JSON completions tolerate common markdown-fenced model output."""
    text = "```json\n{\"summary\":\"ok\"}\n```"

    assert _extract_json_object(text) == '{"summary":"ok"}'


def test_anthropic_payload_shape(db_session: AsyncSession) -> None:
    """Anthropic payloads use a system field plus user message content."""
    client = LLMClient(db_session)

    payload = client._payload("anthropic", "claude-test", "system", "user", 256, 0.2)

    assert payload == {
        "model": "claude-test",
        "system": "system",
        "messages": [{"role": "user", "content": "user"}],
        "max_tokens": 256,
        "temperature": 0.2,
    }


@pytest.mark.parametrize("provider", ["openai", "deepseek", "minimax", "kimi", "gemini"])
def test_openai_compatible_payload_shape(db_session: AsyncSession, provider: str) -> None:
    """OpenAI-compatible providers share the chat-completions payload shape."""
    client = LLMClient(db_session)

    payload = client._payload(provider, "model-test", "system", "user", 512, 0.4)

    assert payload["model"] == "model-test"
    assert payload["messages"] == [
        {"role": "system", "content": "system"},
        {"role": "user", "content": "user"},
    ]
    assert payload["max_tokens"] == 512
    assert payload["temperature"] == 0.4


@pytest.mark.parametrize(
    ("provider", "setting_name", "expected_header"),
    [
        ("openai", "openai_api_key", "Bearer sk-openai"),
        ("deepseek", "deepseek_api_key", "Bearer sk-deepseek"),
        ("minimax", "minimax_api_key", "Bearer sk-minimax"),
        ("kimi", "kimi_api_key", "Bearer sk-kimi"),
        ("gemini", "gemini_api_key", "Bearer sk-gemini"),
    ],
)
def test_headers_for_openai_compatible_providers(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    provider: str,
    setting_name: str,
    expected_header: str,
) -> None:
    """OpenAI-compatible provider headers use Bearer authentication."""
    monkeypatch.setattr(settings, setting_name, expected_header.removeprefix("Bearer "))
    client = LLMClient(db_session)

    headers = client._headers(provider)

    assert headers["authorization"] == expected_header
    assert headers["content-type"] == "application/json"


def test_headers_for_anthropic_provider(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Anthropic provider headers use x-api-key authentication."""
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-anthropic")
    client = LLMClient(db_session)

    headers = client._headers("anthropic")

    assert headers["x-api-key"] == "sk-anthropic"
    assert headers["anthropic-version"] == "2023-06-01"
    assert headers["content-type"] == "application/json"


@pytest.mark.asyncio
async def test_runtime_config_uses_user_default_api_key(db_session: AsyncSession) -> None:
    """User-scoped report calls resolve provider/model/API key from the default saved key."""
    user_id = UUID("11111111-1111-1111-1111-111111111111")
    db_session.add_all(
        [
            SystemConfig(
                key=f"sigma.user.{user_id}.llm.api_keys",
                value={
                    "value": [
                        {
                            "name": "Backup",
                            "key": "sk-backup",
                            "provider": "anthropic",
                            "token_limit": 1000,
                            "is_default": False,
                        },
                        {
                            "name": "Report key",
                            "key": "sk-report",
                            "provider": "openai",
                            "token_limit": 2000,
                            "is_default": True,
                        },
                    ]
                },
            ),
            SystemConfig(key=f"sigma.user.{user_id}.llm.daily_token_limit", value={"value": 12345}),
        ]
    )
    await db_session.commit()

    runtime = await LLMClient(db_session, user_id=user_id)._runtime_config()
    headers = LLMClient(db_session)._headers(runtime.provider, runtime.api_key)

    assert runtime.provider == "openai"
    assert runtime.model == "gpt-4o"
    assert runtime.daily_token_limit == 12345
    assert headers["authorization"] == "Bearer sk-report"


@pytest.mark.parametrize(
    ("provider", "expected"),
    [
        ("anthropic", "https://api.anthropic.com/v1/messages"),
        ("openai", "https://api.openai.com/v1/chat/completions"),
        ("deepseek", "https://api.deepseek.com/chat/completions"),
        ("minimax", "https://api.minimax.io/v1/chat/completions"),
        ("kimi", "https://api.moonshot.cn/v1/chat/completions"),
        ("gemini", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"),
    ],
)
def test_provider_urls(db_session: AsyncSession, provider: str, expected: str) -> None:
    """Provider routing resolves the current chat-completions URL."""
    assert LLMClient(db_session)._url(provider) == expected


def test_parse_response_for_supported_providers(db_session: AsyncSession) -> None:
    """Anthropic and OpenAI-compatible responses normalize text and token usage."""
    client = LLMClient(db_session)

    anthropic = client._parse_response(
        "anthropic",
        {
            "content": [{"type": "text", "text": "Summary"}],
            "usage": {"input_tokens": 7, "output_tokens": 3},
        },
    )
    openai = client._parse_response(
        "openai",
        {
            "choices": [{"message": {"content": "Report"}}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 4},
        },
    )

    assert anthropic == ("Summary", 7, 3)
    assert openai == ("Report", 5, 4)


@pytest.mark.asyncio
async def test_budget_guard_allows_calls_under_limit(db_session: AsyncSession) -> None:
    """Budget guard allows calls that fit under the daily token limit."""
    db_session.add(
        LLMUsageLog(
            provider="anthropic",
            model="claude-test",
            function_type=LLMFunctionType.SUMMARY,
            input_tokens=4,
            output_tokens=2,
        )
    )
    await db_session.commit()

    await LLMClient(db_session)._check_budget(daily_token_limit=10, max_tokens=4)


@pytest.mark.asyncio
async def test_budget_guard_raises_when_limit_would_be_exceeded(db_session: AsyncSession) -> None:
    """Budget guard blocks calls whose max output would exceed the daily limit."""
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

    with pytest.raises(BudgetExceededError):
        await LLMClient(db_session)._check_budget(daily_token_limit=10, max_tokens=2)


@pytest.mark.asyncio
async def test_complete_retries_rate_limits_then_succeeds(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Complete retries transient 429 responses and returns the eventual text."""
    calls = 0

    async def no_sleep(_delay: int) -> None:
        return None

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(
            200,
            json={
                "content": [{"type": "text", "text": "Recovered"}],
                "usage": {"input_tokens": 3, "output_tokens": 2},
            },
        )

    monkeypatch.setattr("app.analyzers.llm_client.asyncio.sleep", no_sleep)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        result = await LLMClient(db_session, http_client=http_client).complete("system", "user", max_tokens=20)

    assert result == "Recovered"
    assert calls == 3


@pytest.mark.asyncio
async def test_complete_raises_after_retry_exhaustion(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Complete raises the final HTTP error after exhausting retry attempts."""
    calls = 0

    async def no_sleep(_delay: int) -> None:
        return None

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(500, json={"error": "upstream unavailable"})

    monkeypatch.setattr("app.analyzers.llm_client.asyncio.sleep", no_sleep)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        with pytest.raises(httpx.HTTPStatusError):
            await LLMClient(db_session, http_client=http_client).complete("system", "user", max_tokens=20)

    assert calls == 3
    assert "LLM request failed after retries" in caplog.text
