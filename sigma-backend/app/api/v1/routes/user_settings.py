from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.llm import LLMConfigRead, LLMConfigUpdate, LLMUsageResponse
from app.schemas.user_settings import (
    UserPasswordUpdate,
    UserProfileUpdate,
    UserReportConfigRead,
    UserReportConfigUpdate,
    UserRetentionUpdate,
    UserSettingsRead,
    UserSettingsUpdate,
)
from app.services import user_settings_service
from app.services.llm_settings import get_llm_config, get_llm_usage, update_llm_config

router = APIRouter()


@router.get("/settings", response_model=UserSettingsRead, response_model_exclude_none=True)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsRead:
    """Return the current user's aggregated settings."""
    return await user_settings_service.get_settings(db, current_user)


@router.put("/settings", response_model=UserSettingsRead, response_model_exclude_none=True)
async def update_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsRead:
    """Update the current user's profile, retention, and report settings together."""
    return await user_settings_service.update_settings(db, current_user, payload)


@router.get("/report-config", response_model=UserReportConfigRead, response_model_exclude_none=True)
async def get_report_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserReportConfigRead:
    """Return the current user's report configuration."""
    return await user_settings_service.get_report_config(db, current_user)


@router.put("/report-config", response_model=UserReportConfigRead, response_model_exclude_none=True)
async def update_report_config(
    payload: UserReportConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserReportConfigRead:
    """Update the current user's report configuration."""
    return await user_settings_service.update_report_config(db, current_user, payload)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update the current user's profile settings."""
    return await user_settings_service.update_profile(db, current_user, payload)


@router.put("/retention", response_model=UserResponse)
async def update_retention(
    payload: UserRetentionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update the current user's data retention preference."""
    return await user_settings_service.update_retention(db, current_user, payload)


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
async def update_password(
    payload: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Update the current user's password."""
    await user_settings_service.update_password(db, current_user, payload)


@router.get("/llm/config", response_model=LLMConfigRead)
async def get_user_llm_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LLMConfigRead:
    """Return LLM settings for any authenticated user."""
    return await get_llm_config(db, current_user.id)


@router.put("/llm/config", response_model=LLMConfigRead)
async def update_user_llm_config(
    payload: LLMConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LLMConfigRead:
    """Update LLM settings for any authenticated user."""
    return await update_llm_config(db, payload, current_user.id)


@router.get("/llm/usage", response_model=LLMUsageResponse)
async def get_user_llm_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LLMUsageResponse:
    """Return LLM usage rollups for any authenticated user."""
    return await get_llm_usage(db, current_user.id)
