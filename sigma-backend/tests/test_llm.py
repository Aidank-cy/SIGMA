from app.services.llm import build_prompt


def test_build_prompt_injects_context_docs() -> None:
    """Context documents are injected before prompt content."""
    prompt = build_prompt("Summarize this.", context_docs=["Doc A", "Doc B"])

    assert prompt.startswith("Reference documents:")
    assert "Doc A" in prompt
    assert "Content:\nSummarize this." in prompt
