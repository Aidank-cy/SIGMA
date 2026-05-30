from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.stats import (
    LastCollectionResponse,
    SentimentStatsResponse,
    TrendingKeywordsResponse,
)
from app.services import stats_service

router = APIRouter()


@router.get("/sentiment", response_model=SentimentStatsResponse)
async def get_sentiment_stats(
    days: int = 0, db: AsyncSession = Depends(get_db)
) -> SentimentStatsResponse:
    """Return bullish percentage across recent summarized items."""
    return await stats_service.get_sentiment_stats(db, days)


@router.get("/trending-keywords", response_model=TrendingKeywordsResponse)
async def get_trending_keywords(
    days: int = 1, db: AsyncSession = Depends(get_db)
) -> TrendingKeywordsResponse:
    """Return top keyword mentions from the selected recent window."""
    return await stats_service.get_trending_keywords(db, days)


@router.get("/last-collection", response_model=LastCollectionResponse)
async def get_last_collection(db: AsyncSession = Depends(get_db)) -> LastCollectionResponse:
    """Return the most recent successful collector execution."""
    return await stats_service.get_last_collection(db)
