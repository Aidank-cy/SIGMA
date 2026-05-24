from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.llm import LLMUsageResponse
from app.services.llm_settings import (
    get_llm_usage as read_llm_usage,
)

router = APIRouter()


@router.get("/usage", response_model=LLMUsageResponse)
async def get_llm_usage(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMUsageResponse:
    """Return LLM usage totals grouped by day and function type."""
    return await read_llm_usage(db)
