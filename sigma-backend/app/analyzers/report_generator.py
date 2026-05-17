from collections import defaultdict
from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.llm_client import LLMClient
from app.analyzers.prompts import report_system_prompt, report_user_prompt
from app.models.collected_item import CollectedItem
from app.models.enums import IntelligenceCategory, LLMFunctionType, Market, ReportType
from app.models.report import Report
from app.utils.event_hooks import notify_new_report


async def generate_report(
    db: AsyncSession,
    report_type: ReportType | str,
    market_scope: list[str],
    category_scope: list[str],
    period_start: date,
    period_end: date,
    locale: str = "zh",
) -> Report:
    """Generate and persist a market intelligence report."""
    resolved_type = ReportType(report_type)
    items = await _load_items(db, market_scope, category_scope, period_start, period_end)
    content = await _generate_content(db, resolved_type, market_scope, category_scope, period_start, period_end, locale, items)
    report = Report(
        report_type=resolved_type,
        title=f"{resolved_type.value.title()} Intelligence Report",
        content=content,
        market_scope=market_scope,
        category_scope=category_scope,
        period_start=period_start,
        period_end=period_end,
        item_count=len(items),
        sentiment_score=_sentiment_score(items),
    )
    db.add(report)
    await db.flush()
    await notify_new_report(report.id)
    return report


async def _load_items(
    db: AsyncSession,
    market_scope: list[str],
    category_scope: list[str],
    period_start: date,
    period_end: date,
) -> list[CollectedItem]:
    start = datetime.combine(period_start, time.min, tzinfo=timezone.utc)
    end = datetime.combine(period_end, time.max, tzinfo=timezone.utc)
    predicates = [CollectedItem.published_at >= start, CollectedItem.published_at <= end]
    if market_scope:
        predicates.append(CollectedItem.market.in_([Market(market) for market in market_scope]))
    if category_scope:
        predicates.append(
            CollectedItem.category.in_([IntelligenceCategory(category) for category in category_scope])
        )
    rows = await db.scalars(select(CollectedItem).where(*predicates).order_by(CollectedItem.published_at.desc()))
    return list(rows)


async def _generate_content(
    db: AsyncSession,
    report_type: ReportType,
    market_scope: list[str],
    category_scope: list[str],
    period_start: date,
    period_end: date,
    locale: str,
    items: list[CollectedItem],
) -> str:
    client = LLMClient(db, function_type=LLMFunctionType.REPORT)
    system_prompt = report_system_prompt(locale)
    if len(items) <= 30:
        user_prompt = report_user_prompt(
            report_type.value,
            period_start,
            period_end,
            market_scope,
            category_scope,
            items,
        )
        return await client.complete(system_prompt, user_prompt, max_tokens=2000)

    grouped: dict[str, list[CollectedItem]] = defaultdict(list)
    for item in items:
        grouped[item.category.value].append(item)

    intermediate: list[str] = []
    for category, category_items in grouped.items():
        prompt = report_user_prompt(
            f"{report_type.value} {category} map pass",
            period_start,
            period_end,
            market_scope,
            [category],
            category_items,
        )
        intermediate.append(await client.complete(system_prompt, prompt, max_tokens=1200))

    reduce_prompt = report_user_prompt(
        f"{report_type.value} reduce pass",
        period_start,
        period_end,
        market_scope,
        category_scope,
        intermediate,
    )
    return await client.complete(system_prompt, reduce_prompt, max_tokens=2500)


def _sentiment_score(items: list[CollectedItem]) -> float:
    if not items:
        return 0.5
    bullish = sum(1 for item in items if _sentiment_for_item(item) == "bullish")
    return round(bullish / len(items), 4)


def _sentiment_for_item(item: CollectedItem) -> str:
    metadata = item.metadata_extra or {}
    metadata_sentiment = metadata.get("sentiment")
    if metadata_sentiment in {"bullish", "bearish", "neutral"}:
        return str(metadata_sentiment)

    text = f"{item.title} {item.summary or ''}".lower()
    positive_terms = ("bullish", "beat", "gain", "growth", "rally", "strong", "上涨", "利好", "增长")
    negative_terms = ("bearish", "decline", "fall", "loss", "risk", "weak", "下跌", "利空", "风险")
    positive = sum(1 for term in positive_terms if term in text)
    negative = sum(1 for term in negative_terms if term in text)
    if positive > negative:
        return "bullish"
    if negative > positive:
        return "bearish"
    return "neutral"
