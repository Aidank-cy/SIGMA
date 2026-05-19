from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.user_report_config import UserReportConfig
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
from app.services.auth_service import hash_password, verify_password
from app.services.llm_settings import (
    get_llm_config as read_llm_config,
    get_llm_usage as read_llm_usage,
    update_llm_config as write_llm_config,
)

router = APIRouter()


@router.get("/settings", response_model=UserSettingsRead)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsRead:
    """Return the current user's aggregated settings."""
    config = await _get_or_create_config(db, current_user)
    return _settings_response(current_user, config)


@router.put("/settings", response_model=UserSettingsRead)
async def update_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsRead:
    """Update the current user's profile, retention, and report settings together."""
    config = await _get_or_create_config(db, current_user)
    current_user.display_name = payload.display_name
    current_user.locale = payload.locale
    current_user.data_retention_days = payload.data_retention_days
    config.report_frequency = payload.report_frequency
    config.markets = payload.markets
    config.categories = payload.categories
    config.is_active = payload.is_active
    await db.commit()
    await db.refresh(current_user)
    await db.refresh(config)
    return _settings_response(current_user, config)


@router.get("/report-config", response_model=UserReportConfigRead)
async def get_report_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserReportConfigRead:
    """Return the current user's report configuration."""
    config = await _get_or_create_config(db, current_user)
    return UserReportConfigRead.model_validate(config)


@router.put("/report-config", response_model=UserReportConfigRead)
async def update_report_config(
    payload: UserReportConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserReportConfigRead:
    """Update the current user's report configuration."""
    config = await _get_or_create_config(db, current_user)
    for key, value in payload.model_dump().items():
        setattr(config, key, value)
    await db.commit()
    await db.refresh(config)
    return UserReportConfigRead.model_validate(config)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update the current user's profile settings."""
    current_user.display_name = payload.display_name
    current_user.locale = payload.locale
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.put("/retention", response_model=UserResponse)
async def update_retention(
    payload: UserRetentionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update the current user's data retention preference."""
    current_user.data_retention_days = payload.data_retention_days
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
async def update_password(
    payload: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Update the current user's password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()


@router.get("/llm/config", response_model=LLMConfigRead)
async def get_user_llm_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LLMConfigRead:
    """Return LLM settings for any authenticated user."""
    return await read_llm_config(db, current_user.id)


@router.put("/llm/config", response_model=LLMConfigRead)
async def update_user_llm_config(
    payload: LLMConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LLMConfigRead:
    """Update LLM settings for any authenticated user."""
    return await write_llm_config(db, payload, current_user.id)


@router.get("/llm/usage", response_model=LLMUsageResponse)
async def get_user_llm_usage(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LLMUsageResponse:
    """Return LLM usage rollups for any authenticated user."""
    return await read_llm_usage(db)


async def _get_or_create_config(db: AsyncSession, current_user: User) -> UserReportConfig:
    config = await db.scalar(select(UserReportConfig).where(UserReportConfig.user_id == current_user.id))
    if config is not None:
        return config
    config = UserReportConfig(user_id=current_user.id)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


def _settings_response(user: User, config: UserReportConfig) -> UserSettingsRead:
    return UserSettingsRead(
        display_name=user.display_name,
        locale=user.locale,
        data_retention_days=user.data_retention_days,
        report_frequency=config.report_frequency,
        markets=[str(market) for market in config.markets],
        categories=[str(category) for category in config.categories],
        is_active=config.is_active,
    )
