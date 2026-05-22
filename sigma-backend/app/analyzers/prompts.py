from app.models.collected_item import CollectedItem

SUMMARY_SYSTEM = (
    "You are a financial news analyst. Analyze the item for investors and write in {locale}. "
    "Return only valid JSON with this exact shape: "
    '{{"sentiment":"bullish|bearish|neutral","summary":"1-2 concise factual sentences","keywords":["keyword"]}}. '
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
    "You are a market intelligence analyst. Write a structured markdown report in {locale}. "
    "The report subtitle line must include the exact period with times in this format: "
    "'Daily Market Report | YYYY-MM-DD (HH:MM) to YYYY-MM-DD (HH:MM)'. "
    "Use level-2 markdown headings for these sections: Overview, Sentiment Analysis, "
    "Politics, Finance, Tech, Timeline, Outlook, Sources. Include concise source "
    "attribution with source titles and URLs in Sources."
)

REPORT_USER = (
    "Report type: {report_type}\n"
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


def report_system_prompt(locale: str) -> str:
    """Render the report system prompt."""
    return REPORT_SYSTEM.format(locale=locale)


def report_user_prompt(
    report_type: str,
    period_start: object,
    period_end: object,
    markets: list[str],
    categories: list[str],
    items: list[CollectedItem] | list[str],
) -> str:
    """Render a report prompt from collected items or intermediate summaries."""
    start_time = "00:00"
    end_time = "23:59"
    if items and isinstance(items[0], CollectedItem):
        timestamps = [item.published_at for item in items if hasattr(item, "published_at")]
        if timestamps:
            start_time = min(timestamps).strftime("%H:%M")
            end_time = max(timestamps).strftime("%H:%M")

    rendered_items = "\n\n".join(_render_item(item) for item in items)
    return REPORT_USER.format(
        report_type=report_type,
        period_start=period_start,
        period_end=period_end,
        start_time=start_time,
        end_time=end_time,
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


def _truncate(content: str, limit: int = 3000) -> str:
    return content if len(content) <= limit else content[:limit]
