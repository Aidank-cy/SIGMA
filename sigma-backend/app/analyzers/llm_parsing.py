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
