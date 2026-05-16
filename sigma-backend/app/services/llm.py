from typing import Protocol

from app.analyzers.llm_client import build_prompt as analyzer_build_prompt


class LLMClient(Protocol):
    """Runtime-switchable LLM client interface."""

    async def complete(self, prompt: str, context_docs: list[str] | None = None) -> str:
        """Complete a prompt with optional reference documents."""
        ...


def build_prompt(prompt: str, context_docs: list[str] | None = None) -> str:
    """Build a prompt with optional RAG context injection."""
    return analyzer_build_prompt(prompt, context_docs)
