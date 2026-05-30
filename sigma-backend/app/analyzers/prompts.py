from datetime import date, datetime

from app.models.collected_item import CollectedItem

SUMMARY_SYSTEM = (
    "You are a financial news analyst. Analyze the item for investors and write in {locale}. "
    "Return only valid JSON with this exact shape: "
    '{{"sentiment":"bullish|bearish|neutral",'
    '"summary":"1-2 concise factual sentences","keywords":["keyword"]}}. '
    "Do not wrap the JSON in markdown."
)

SUMMARY_USER = (
    "Title: {title}\n"
    "Category: {category}\n"
    "Market: {market}\n"
    "Published at: {published_at}\n\n"
    "Content:\n{content}"
)

REPORT_SYSTEM = (
    "You are a senior market intelligence analyst at a global macro research firm. "
    "Write a structured markdown report in {locale}. "
    "Your response MUST NOT exceed {max_tokens} tokens.\n\n"
    "CRITICAL INSTRUCTIONS:\n"
    "1. FILTER: The input items may contain noise — duplicates, irrelevant press releases, "
    "promotional content, or items with weak market relevance. Silently discard low-quality "
    "items. Only include items that carry actionable intelligence for institutional investors.\n"
    "2. CROSS-CATEGORY ANALYSIS: Identify causal links across categories. For example, a "
    "political policy change that impacts a specific sector, a macro indicator that triggers "
    "a chain reaction in equity and FX markets, or a tech regulation that shifts capital flows. "
    "Explicitly call out these cross-domain connections in the Overview and Outlook sections.\n"
    "3. CHAIN REACTIONS: When multiple items point to the same underlying theme, synthesize "
    "them into a single narrative thread rather than listing them separately. Highlight "
    "second-order and third-order effects (e.g., tariff → supply chain disruption → "
    "semiconductor shortage → revised earnings guidance).\n"
    "4. INTERNAL LOGIC: Within each category section, order items by market impact magnitude, "
    "not by publish time. Lead with the most consequential development.\n"
    "5. STRUCTURE: Use level-2 markdown headings for exactly these sections: "
    "Executive Summary, Cross-Market Dynamics, Political Risk, Financial Markets, "
    "Technology & Innovation, Macro Indicators, Timeline, Forward Outlook, Sources.\n"
    "6. In the Sources section, include concise attribution with titles and URLs.\n"
    "7. FORMATTING RULES:\n"
    "   - Always insert a blank line before any bulleted or numbered list.\n"
    "   - Always insert a blank line between list items that contain multiple sentences.\n"
    "   - Use level-3 headings (###) for sub-sections within each level-2 section.\n"
    "   - In the Timeline section, present events as a reverse-chronological vertical "
    "timeline ordered by market impact significance, using this format:\n"
    "     ### Timeline\n"
    "     **YYYY-MM-DD HH:MM** — [Event title]: Brief impact description.\n"
    "\n"
    "     **YYYY-MM-DD HH:MM** — [Event title]: Brief impact description.\n"
    "   - Do NOT use horizontal tables for the Timeline.\n"
    "   - Keep paragraphs concise (3-4 sentences max). Use sub-headings liberally to "
    "break up walls of text.\n"
    "   - For chain reaction sequences, use the arrow notation on its own line: A → B → C\n"
    "8. TITLE: The report title must NOT contain underscores. Use proper spacing: "
    '"Daily Morning Intelligence Report", not "Daily_Morning Intelligence Report".'
)

REPORT_USER = (
    "Report type: {report_type}\n"
    "Report label: {report_label}\n"
    "Period: {period_start} ({start_time}) to {period_end} ({end_time})\n"
    "Markets: {markets}\n"
    "Categories: {categories}\n\n"
    "Items:\n{items}"
)


def summary_system_prompt(locale: str) -> str:
    """Render the per-item summary system prompt."""
    return SUMMARY_SYSTEM.format(locale=locale)


def summary_user_prompt(item: CollectedItem) -> str:
    """Render the per-item summary user prompt with bounded source content."""
    return SUMMARY_USER.format(
        title=item.title,
        category=item.category.value,
        market=item.market.value,
        published_at=item.published_at.isoformat(),
        content=_truncate(item.content_raw),
    )


def report_system_prompt(locale: str, max_tokens: int, report_type: str) -> str:
    """Render the report system prompt."""
    return REPORT_SYSTEM.format(locale=locale, max_tokens=max_tokens, report_type=report_type)


def report_user_prompt(
    report_type: str,
    report_label: str,
    period_start: object,
    period_end: object,
    markets: list[str],
    categories: list[str],
    items: list[CollectedItem] | list[str],
) -> str:
    """Render a report prompt from collected items or intermediate summaries."""
    rendered_items = "\n\n".join(_render_item(item) for item in items)
    return REPORT_USER.format(
        report_type=report_type,
        report_label=report_label,
        period_start=_format_period_date(period_start),
        period_end=_format_period_date(period_end),
        start_time=_format_period_time(period_start, "00:00"),
        end_time=_format_period_time(period_end, "23:59"),
        markets=", ".join(markets) if markets else "all",
        categories=", ".join(categories) if categories else "all",
        items=_truncate(rendered_items),
    )


def _render_item(item: CollectedItem | str) -> str:
    if isinstance(item, str):
        return item
    summary = item.summary or item.content_raw
    source = item.content_url or "unavailable"
    return (
        f"- {item.title}\n"
        f"  Category: {item.category.value}; Market: {item.market.value}; "
        f"Published: {item.published_at.isoformat()}\n"
        f"  Source: {source}\n"
        f"  Summary: {_truncate(summary)}"
    )


def _format_period_date(value: object) -> str:
    if isinstance(value, datetime | date):
        return value.strftime("%Y-%m-%d")
    return str(value)


def _format_period_time(value: object, fallback: str) -> str:
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    return fallback


def _truncate(content: str, limit: int = 3000) -> str:
    return content if len(content) <= limit else content[:limit]
