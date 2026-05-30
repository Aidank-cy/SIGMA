from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_admin
from app.models.user import User
from app.schemas.llm import LLMUsageResponse
from app.services.llm_settings import (
    get_llm_usage as read_llm_usage,
)

router = APIRouter()


@router.get("/usage", response_model=LLMUsageResponse)
async def get_llm_usage(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> LLMUsageResponse:
    """Return LLM usage totals grouped by day and function type."""
    return await read_llm_usage(db)
