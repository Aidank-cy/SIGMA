from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

from app.models.collected_item import CollectedItem
from app.models.enums import ReportType

BEIJING_TZ = ZoneInfo("Asia/Shanghai")


def _period_start_datetime(value: date | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
    return datetime.combine(value, time.min, tzinfo=UTC)


def _period_end_datetime(value: date | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
    return datetime.combine(value, time.max, tzinfo=UTC)


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
