from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
import logging
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analyzers.llm_client import DEFAULT_PROVIDER_MODELS, LLMClient
from app.analyzers.prompts import report_system_prompt, report_user_prompt
from app.core.config import settings
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, LLMFunctionType, Market, ReportType
from app.models.report import Report
from app.models.system_config import SystemConfig
from app.services.report_settings import get_report_max_tokens_for_type, report_type_label
from app.utils.event_hooks import notify_new_report

BEIJING_TZ = ZoneInfo("Asia/Shanghai")
LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReportLLMRuntime:
    provider: str
    model: str
    api_key: str | None


async def generate_report(
    db: AsyncSession,
    report_type: ReportType | str,
    market_scope: list[str],
    category_scope: list[str],
    period_start: date | datetime,
    period_end: date | datetime,
    locale: str = "zh",
    user_id: UUID | None = None,
) -> Report | None:
    """Generate and persist a market intelligence report."""
    resolved_type = ReportType(report_type)
    start = _period_start_datetime(period_start)
    end = _period_end_datetime(period_end)
    items = await _load_items(db, market_scope, category_scope, start, end, user_id=user_id)
    content = await _generate_content(
        db,
        resolved_type,
        market_scope,
        category_scope,
        start,
        end,
        locale,
        items,
        user_id,
    )
    if content is None:
        return None
    report = Report(
        report_type=resolved_type,
        title=_report_title(resolved_type, end),
        content=content,
        market_scope=market_scope,
        category_scope=category_scope,
        period_start=start,
        period_end=end,
        user_id=user_id,
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
    period_start: datetime,
    period_end: datetime,
    user_id: UUID | None = None,
) -> list[CollectedItem]:
    predicates = [
        CollectedItem.published_at >= period_start,
        CollectedItem.published_at <= period_end,
    ]
    if market_scope:
        predicates.append(CollectedItem.market.in_([Market(market) for market in market_scope]))
    if category_scope:
        predicates.append(
            CollectedItem.category.in_(
                [IntelligenceCategory(category) for category in category_scope]
            )
        )
    statement = select(CollectedItem)
    if user_id is not None:
        statement = statement.join(DataSource, CollectedItem.source_id == DataSource.id)
        predicates.append(CollectedItem.source_id == DataSource.id)
        predicates.append(or_(DataSource.is_system.is_(True), DataSource.created_by == user_id))
    rows = await db.scalars(
        statement.where(*predicates).order_by(CollectedItem.published_at.desc())
    )
    return list(rows)


async def _generate_content(
    db: AsyncSession,
    report_type: ReportType,
    market_scope: list[str],
    category_scope: list[str],
    period_start: datetime,
    period_end: datetime,
    locale: str,
    items: list[CollectedItem],
    user_id: UUID | None,
) -> str | None:
    runtime = await _resolve_report_llm_runtime(db, user_id)
    if runtime is None:
        return None
    client = LLMClient(
        db,
        function_type=LLMFunctionType.REPORT,
        user_id=user_id,
        provider=runtime.provider,
        model=runtime.model,
        api_key=runtime.api_key,
    )
    max_tokens = await get_report_max_tokens_for_type(db, user_id, report_type)
    report_label = report_type_label(report_type)
    system_prompt = report_system_prompt(locale, max_tokens, report_label)
    if len(items) <= 30:
        user_prompt = report_user_prompt(
            report_type.value,
            report_label,
            period_start,
            period_end,
            market_scope,
            category_scope,
            items,
        )
        return await client.complete(system_prompt, user_prompt, max_tokens=max_tokens)

    grouped: dict[str, list[CollectedItem]] = defaultdict(list)
    for item in items:
        grouped[item.category.value].append(item)

    intermediate: list[str] = []
    for category, category_items in grouped.items():
        prompt = report_user_prompt(
            f"{report_type.value} {category} map pass",
            f"{report_label} {category} Map Pass",
            period_start,
            period_end,
            market_scope,
            [category],
            category_items,
        )
        intermediate.append(await client.complete(system_prompt, prompt, max_tokens=max_tokens))

    reduce_prompt = report_user_prompt(
        f"{report_type.value} reduce pass",
        f"{report_label} Reduce Pass",
        period_start,
        period_end,
        market_scope,
        category_scope,
        intermediate,
    )
    return await client.complete(system_prompt, reduce_prompt, max_tokens=max_tokens)


async def _resolve_report_llm_runtime(
    db: AsyncSession,
    user_id: UUID | None,
) -> ReportLLMRuntime | None:
    selected_api_key: str | None = None
    selected_key_provider: str | None = None

    if user_id is not None:
        api_keys_config = await _raw_config_value(db, f"sigma.user.{user_id}.llm.api_keys")
        if api_keys_config.found:
            api_keys = api_keys_config.value if isinstance(api_keys_config.value, list) else []
            if not api_keys:
                LOGGER.warning(
                    "Skipping report generation for user %s because no LLM API keys are configured.",
                    user_id,
                )
                return None
            selected_key = _select_report_api_key(api_keys)
            if selected_key is None:
                LOGGER.warning(
                    "Skipping report generation for user %s because no valid LLM API keys are configured.",
                    user_id,
                )
                return None
            selected_api_key = selected_key["key"]
            selected_key_provider = selected_key.get("provider")

    user_prefix = f"sigma.user.{user_id}.llm" if user_id is not None else None
    user_provider = await _config_value(db, f"{user_prefix}.provider") if user_prefix else None
    system_provider = await _config_value(db, "sigma.llm.provider")
    provider = _normalize_provider(user_provider or selected_key_provider or system_provider)
    if provider is None:
        provider = str(settings.default_llm_provider).lower()

    user_model = await _config_value(db, f"{user_prefix}.model") if user_prefix else None
    system_model = await _config_value(db, "sigma.llm.model")
    model = str(user_model or system_model or DEFAULT_PROVIDER_MODELS.get(provider, settings.default_llm_model))

    return ReportLLMRuntime(provider=provider, model=model, api_key=selected_api_key)


@dataclass(frozen=True)
class _ConfigValue:
    found: bool
    value: object = None


async def _raw_config_value(db: AsyncSession, key: str) -> _ConfigValue:
    config = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    if config is None:
        return _ConfigValue(found=False)
    value = config.value.get("value") if isinstance(config.value, dict) else None
    return _ConfigValue(found=True, value=value)


async def _config_value(db: AsyncSession, key: str) -> object | None:
    return (await _raw_config_value(db, key)).value


def _select_report_api_key(api_keys: list[object]) -> dict[str, str] | None:
    valid_keys = [
        {
            "key": str(item["key"]),
            "provider": str(item.get("provider", "")).lower(),
            "is_default": bool(item.get("is_default", False)),
        }
        for item in api_keys
        if isinstance(item, dict) and item.get("key")
    ]
    if not valid_keys:
        return None
    for api_key in valid_keys:
        if api_key["is_default"]:
            return api_key
    return valid_keys[0]


def _normalize_provider(provider: object) -> str | None:
    if not isinstance(provider, str) or not provider.strip():
        return None
    return provider.strip().lower()


def _period_start_datetime(value: date | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def _period_end_datetime(value: date | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return datetime.combine(value, time.max, tzinfo=timezone.utc)


def _report_title(report_type: ReportType, period_end: datetime) -> str:
    local_end = period_end.astimezone(BEIJING_TZ)
    if report_type == ReportType.MONTHLY:
        return f"{local_end:%m/%Y} Monthly Report"
    labels = {
        ReportType.DAILY_MORNING: "Daily Morning",
        ReportType.DAILY_AFTERNOON: "Daily Afternoon",
        ReportType.DAILY: "Daily",
        ReportType.WEEKLY: "Weekly",
    }
    return f"{local_end:%d/%m/%Y} {labels[report_type]} Report"


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
    positive_terms = (
        "bullish",
        "beat",
        "gain",
        "growth",
        "rally",
        "strong",
        "上涨",
        "利好",
        "增长",
    )
    negative_terms = ("bearish", "decline", "fall", "loss", "risk", "weak", "下跌", "利空", "风险")
    positive = sum(1 for term in positive_terms if term in text)
    negative = sum(1 for term in negative_terms if term in text)
    if positive > negative:
        return "bullish"
    if negative > positive:
        return "bearish"
    return "neutral"
