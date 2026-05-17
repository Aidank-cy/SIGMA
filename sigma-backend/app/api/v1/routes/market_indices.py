from fastapi import APIRouter

from app.schemas.market import MarketIndicesResponse
from app.services.market_indices import get_market_indices

router = APIRouter()


@router.get("", response_model=MarketIndicesResponse)
async def list_market_indices() -> MarketIndicesResponse:
    """Return current major global market indices."""
    return await get_market_indices()
