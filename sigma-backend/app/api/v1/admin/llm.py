from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.llm import LLMConfigRead, LLMConfigUpdate, LLMUsageResponse
from app.services.llm_settings import (
    get_llm_config as read_llm_config,
    get_llm_usage as read_llm_usage,
    update_llm_config as write_llm_config,
)

router = APIRouter()


@router.get("/config", response_model=LLMConfigRead)
async def get_llm_config(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Return runtime LLM provider, model, and budget settings."""
    return await read_llm_config(db)


@router.put("/config", response_model=LLMConfigRead)
async def update_llm_config(
    payload: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Update runtime LLM provider, model, and budget settings."""
    return await write_llm_config(db, payload)


@router.get("/usage", response_model=LLMUsageResponse)
async def get_llm_usage(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMUsageResponse:
    """Return LLM usage totals grouped by day and function type."""
    return await read_llm_usage(db)
