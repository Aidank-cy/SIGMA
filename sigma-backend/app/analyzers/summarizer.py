import asyncio
import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.analyzers.llm_client import LLMClient
from app.analyzers.prompts import summary_system_prompt, summary_user_prompt
from app.database import AsyncSessionLocal
from app.models.collected_item import CollectedItem
from app.models.enums import LLMFunctionType

logger = logging.getLogger(__name__)


async def summarize_item(item: CollectedItem, db: AsyncSession, locale: str = "zh") -> str:
    """Summarize one collected item."""
    client = LLMClient(db, function_type=LLMFunctionType.SUMMARY)
    payload = await client.complete_json(
        summary_system_prompt(locale), summary_user_prompt(item), max_tokens=300
    )
    return json.dumps(
        _normalize_summary_payload(payload), ensure_ascii=False, separators=(",", ":")
    )


def _normalize_summary_payload(payload: dict[str, Any]) -> dict[str, Any]:
    sentiment = str(payload.get("sentiment") or "neutral").lower()
    if sentiment not in {"bullish", "bearish", "neutral"}:
        sentiment = "neutral"
    summary = str(payload.get("summary") or "").strip()
    if not summary:
        raise ValueError("LLM summary JSON did not include a summary")
    raw_keywords = payload.get("keywords") or []
    keywords = [str(keyword).strip() for keyword in raw_keywords if str(keyword).strip()]
    return {"sentiment": sentiment, "summary": summary, "keywords": keywords[:12]}


async def batch_summarize(
    item_ids: list[UUID],
    db: AsyncSession | None = None,
    concurrency: int = 5,
    locale: str = "zh",
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    """Summarize a batch of collected items without failing the whole batch."""
    if db is not None:
        await _batch_summarize_in_session(item_ids, db, concurrency, locale)
        return
    async with session_factory() as session:
        await _batch_summarize_in_session(item_ids, session, concurrency, locale)
        await session.commit()


async def _batch_summarize_in_session(
    item_ids: list[UUID],
    db: AsyncSession,
    concurrency: int,
    locale: str,
) -> None:
    if not item_ids:
        return
    items = list(await db.scalars(select(CollectedItem).where(CollectedItem.id.in_(item_ids))))
    semaphore = asyncio.Semaphore(concurrency)

    async def run(item: CollectedItem) -> None:
        if item.summary:
            return
        retry_count = int((item.metadata_extra or {}).get("summary_retry_count", 0))
        if retry_count >= 3:
            return
        async with semaphore:
            try:
                item.summary = await summarize_item(item, db, locale)
            except Exception as exc:
                metadata = dict(item.metadata_extra or {})
                metadata["summary_retry_count"] = min(retry_count + 1, 3)
                item.metadata_extra = metadata
                logger.warning("Failed to summarize collected item %s: %s", item.id, exc)

    await asyncio.gather(*(run(item) for item in items))
    await db.flush()
