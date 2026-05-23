import json
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.schemas.item import ItemDetail, ItemListResponse, ItemSummary, MinimalItem
from app.utils.redis_lock import create_redis_client

router = APIRouter()


@router.get("", response_model=ItemListResponse)
async def list_items(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    since: datetime | None = None,
    category: str | None = None,
    market: str | None = None,
    source_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    keyword: str | None = None,
    format: str = Query(default="full", pattern="^(full|minimal)$"),
    db: AsyncSession = Depends(get_db),
) -> ItemListResponse:
    """Return collected items with standard pagination metadata."""
    cache_key = _cache_key(page, page_size, since, category, market, source_id, date_from, date_to, keyword, format)
    cached = await _cache_get(cache_key)
    if cached:
        return ItemListResponse.model_validate_json(cached)

    predicate = _item_predicate(since, category, market, source_id, date_from, date_to, keyword)
    total = await db.scalar(select(func.count()).select_from(CollectedItem).where(*predicate))
    statement = (
        select(CollectedItem, DataSource.name)
        .join(DataSource, DataSource.id == CollectedItem.source_id)
        .where(*predicate)
        .order_by(CollectedItem.collected_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(statement)).all()
    if format == "minimal":
        items = [_minimal(row[0]) for row in rows]
    else:
        items = [_summary(row[0], row[1]) for row in rows]
    response = ItemListResponse(
        page=page,
        page_size=page_size,
        total=total or 0,
        has_next=(page * page_size) < (total or 0),
        items=items,
    )
    await _cache_set(cache_key, response.model_dump_json())
    return response


@router.get("/{item_id}", response_model=ItemDetail)
async def get_item(item_id: UUID, db: AsyncSession = Depends(get_db)) -> ItemDetail:
    """Return collected item detail with related items."""
    row = await db.execute(
        select(CollectedItem, DataSource.name)
        .join(DataSource, DataSource.id == CollectedItem.source_id)
        .where(CollectedItem.id == item_id)
    )
    result = row.first()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    item, source_name = result
    related_rows = await db.scalars(
        select(CollectedItem)
        .where(
            CollectedItem.id != item_id,
            CollectedItem.category == item.category,
            CollectedItem.market == item.market,
        )
        .order_by(CollectedItem.published_at.desc())
        .limit(5)
    )
    detail = ItemDetail(
        **_summary(item, source_name).model_dump(),
        content_raw=item.content_raw,
        metadata_extra=item.metadata_extra,
        sentiment=_sentiment_for_item(item),
        keywords=_keywords_for_item(item),
        related=[_minimal(related) for related in related_rows],
    )
    return detail


def _item_predicate(
    since: datetime | None,
    category: str | None,
    market: str | None,
    source_id: UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
    keyword: str | None,
) -> list[object]:
    predicate: list[object] = []
    if since:
        predicate.append(CollectedItem.collected_at >= since)
    if category:
        predicate.append(CollectedItem.category.in_(_split_filter(category)))
    if market:
        predicate.append(CollectedItem.market.in_(_split_filter(market)))
    if source_id:
        predicate.append(CollectedItem.source_id == source_id)
    if date_from:
        predicate.append(CollectedItem.published_at >= date_from)
    if date_to:
        predicate.append(CollectedItem.published_at <= date_to)
    if keyword:
        pattern = f"%{keyword}%"
        predicate.append(or_(CollectedItem.title.ilike(pattern), CollectedItem.content_raw.ilike(pattern)))
    return predicate


def _split_filter(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _minimal(item: CollectedItem) -> MinimalItem:
    return MinimalItem(
        id=item.id,
        title=item.title,
        summary=_summary_text(item.summary),
        category=item.category.value,
        market=item.market.value,
        published_at=item.published_at,
    )


def _summary(item: CollectedItem, source_name: str) -> ItemSummary:
    return ItemSummary(
        **_minimal(item).model_dump(),
        content_url=item.content_url,
        collected_at=item.collected_at,
        expires_at=item.expires_at,
        source_id=item.source_id,
        source_name=source_name,
    )


def _sentiment_for_item(item: CollectedItem) -> str:
    metadata = item.metadata_extra or {}
    metadata_sentiment = metadata.get("sentiment")
    if metadata_sentiment in {"bullish", "bearish", "neutral"}:
        return str(metadata_sentiment)
    summary_payload = _summary_payload(item.summary)
    summary_sentiment = summary_payload.get("sentiment")
    if summary_sentiment in {"bullish", "bearish", "neutral"}:
        return str(summary_sentiment)

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


def _keywords_for_item(item: CollectedItem) -> list[str]:
    metadata = item.metadata_extra or {}
    metadata_keywords = metadata.get("keywords")
    if isinstance(metadata_keywords, list):
        return [
            str(keyword).strip()
            for keyword in metadata_keywords
            if isinstance(keyword, str) and len(keyword.strip()) >= 2
        ][:12]
    summary_keywords = _summary_payload(item.summary).get("keywords")
    if isinstance(summary_keywords, list):
        return [
            str(keyword).strip()
            for keyword in summary_keywords
            if isinstance(keyword, str) and len(keyword.strip()) >= 2
        ][:12]

    text = f"{item.title} {item.summary or ''}"
    stop_words = {
        "about",
        "after",
        "and",
        "from",
        "market",
        "markets",
        "said",
        "stock",
        "stocks",
        "that",
        "the",
        "with",
    }
    seen: set[str] = set()
    keywords: list[str] = []
    for token in text.replace("/", " ").replace("-", " ").split():
        normalized = token.strip(".,:;!?()[]{}\"'").lower()
        if len(normalized) < 4 or normalized in stop_words or normalized.isnumeric() or normalized in seen:
            continue
        seen.add(normalized)
        keywords.append(normalized)
    return keywords[:8]


def _summary_text(summary: str | None) -> str | None:
    if summary is None:
        return None
    payload = _summary_payload(summary)
    if isinstance(payload.get("summary"), str):
        return str(payload["summary"])
    return summary


def _summary_payload(summary: str | None) -> dict[str, object]:
    if not summary:
        return {}
    try:
        parsed = json.loads(summary)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _cache_key(*parts: object) -> str:
    joined = ":".join(str(part) for part in parts)
    return f"sigma:items:{joined}"


async def _cache_get(key: str) -> str | None:
    client = create_redis_client()
    try:
        cached = await client.get(key)
    except Exception:
        return None
    finally:
        await client.aclose()
    return str(cached) if cached else None


async def _cache_set(key: str, value: str) -> None:
    client = create_redis_client()
    try:
        await client.set(key, value, ex=300)
    except Exception:
        return
    finally:
        await client.aclose()
