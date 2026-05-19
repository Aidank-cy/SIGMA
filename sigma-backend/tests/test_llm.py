import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.llm_client import LLMClient
from app.core.config import settings
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


def test_headers_for_anthropic_and_openai_compatible_providers(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Provider headers pull from the configured API key fields."""
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-anthropic")
    monkeypatch.setattr(settings, "openai_api_key", "sk-openai")
    client = LLMClient(db_session)

    anthropic_headers = client._headers("anthropic")
    openai_headers = client._headers("openai")

    assert anthropic_headers["x-api-key"] == "sk-anthropic"
    assert anthropic_headers["anthropic-version"] == "2023-06-01"
    assert openai_headers["authorization"] == "Bearer sk-openai"
    assert openai_headers["content-type"] == "application/json"


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
