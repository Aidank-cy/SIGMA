from fastapi import APIRouter

from app.schemas.market import MarketIndex
from app.services.market_indices import get_market_indices

router = APIRouter()


@router.get("", response_model=list[MarketIndex])
async def list_market_indices() -> list[MarketIndex]:
    """Return current major global market indices."""
    response = await get_market_indices()
    return response.indices
