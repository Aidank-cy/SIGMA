from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.enums import CollectorStatus
from app.schemas.stats import LastCollectionResponse, SentimentStatsResponse, TrendingKeyword, TrendingKeywordsResponse

router = APIRouter()

POSITIVE_TERMS = {
    "bullish",
    "beat",
    "beats",
    "gain",
    "gains",
    "growth",
    "higher",
    "outperform",
    "rally",
    "strong",
    "upside",
    "上涨",
    "利好",
    "增长",
    "走强",
}
NEGATIVE_TERMS = {
    "bearish",
    "decline",
    "downside",
    "fall",
    "falls",
    "loss",
    "losses",
    "miss",
    "risk",
    "weak",
    "下跌",
    "利空",
    "风险",
    "走弱",
}
STOP_WORDS = {
    "about",
    "after",
    "against",
    "and",
    "are",
    "as",
    "for",
    "from",
    "has",
    "into",
    "its",
    "market",
    "markets",
    "new",
    "not",
    "on",
    "over",
    "said",
    "says",
    "stock",
    "stocks",
    "that",
    "the",
    "this",
    "with",
}


@router.get("/sentiment", response_model=SentimentStatsResponse)
async def get_sentiment_stats(db: AsyncSession = Depends(get_db)) -> SentimentStatsResponse:
    """Return bullish percentage across recent summarized items."""
    rows = await db.scalars(
        select(CollectedItem)
        .where(CollectedItem.summary.is_not(None))
        .order_by(CollectedItem.collected_at.desc())
        .limit(100)
    )
    sentiments = [_sentiment_for_item(item) for item in rows]
    if not sentiments:
        return SentimentStatsResponse(bullish_pct=50)
    bullish = sentiments.count("bullish")
    return SentimentStatsResponse(bullish_pct=round((bullish / len(sentiments)) * 100))


@router.get("/trending-keywords", response_model=TrendingKeywordsResponse)
async def get_trending_keywords(db: AsyncSession = Depends(get_db)) -> TrendingKeywordsResponse:
    """Return top keyword mentions from the last 24 hours."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = await db.scalars(
        select(CollectedItem)
        .where(CollectedItem.collected_at >= since)
        .order_by(CollectedItem.collected_at.desc())
        .limit(250)
    )
    counts: Counter[str] = Counter()
    for item in rows:
        counts.update(_keywords_for_item(item))
    return TrendingKeywordsResponse(
        items=[TrendingKeyword(keyword=keyword, count=count) for keyword, count in counts.most_common(5)]
    )


@router.get("/last-collection", response_model=LastCollectionResponse)
async def get_last_collection(db: AsyncSession = Depends(get_db)) -> LastCollectionResponse:
    """Return the most recent successful collector execution."""
    last_success = await db.scalar(
        select(CollectorLog.executed_at)
        .where(CollectorLog.status == CollectorStatus.SUCCESS)
        .order_by(CollectorLog.executed_at.desc())
        .limit(1)
    )
    if last_success and last_success.tzinfo is None:
        last_success = last_success.replace(tzinfo=timezone.utc)
    return LastCollectionResponse(last_success=last_success.isoformat() if last_success else None)


def _sentiment_for_item(item: CollectedItem) -> str:
    metadata = item.metadata_extra or {}
    metadata_sentiment = metadata.get("sentiment")
    if metadata_sentiment in {"bullish", "bearish", "neutral"}:
        return str(metadata_sentiment)

    text = f"{item.title} {item.summary or ''}".lower()
    positive = sum(1 for term in POSITIVE_TERMS if term in text)
    negative = sum(1 for term in NEGATIVE_TERMS if term in text)
    if positive > negative:
        return "bullish"
    if negative > positive:
        return "bearish"
    return "neutral"


def _keywords_for_item(item: CollectedItem) -> list[str]:
    metadata = item.metadata_extra or {}
    metadata_keywords = metadata.get("keywords")
    if isinstance(metadata_keywords, list):
        return [
            str(keyword).strip()
            for keyword in metadata_keywords
            if isinstance(keyword, str) and len(keyword.strip()) >= 2
        ]

    text = f"{item.title} {item.summary or ''}"
    tokens = [
        token.strip(".,:;!?()[]{}\"'").lower()
        for token in text.replace("/", " ").replace("-", " ").split()
    ]
    return [
        token
        for token in tokens
        if len(token) >= 4 and token not in STOP_WORDS and not token.isnumeric()
    ][:8]
