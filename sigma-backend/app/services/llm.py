from typing import Protocol


class LLMClient(Protocol):
    """Runtime-switchable LLM client interface."""

    async def complete(self, prompt: str, context_docs: list[str] | None = None) -> str:
        """Complete a prompt with optional reference documents."""
        ...


def build_prompt(prompt: str, context_docs: list[str] | None = None) -> str:
    """Build a prompt with optional RAG context injection."""
    if not context_docs:
        return prompt

    references = "\n\n".join(context_docs)
    return f"Reference documents:\n{references}\n\nContent:\n{prompt}"
