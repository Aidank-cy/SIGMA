from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.enums import ReportType
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
)
from app.services.llm_settings import (
    get_llm_usage as read_llm_usage,
)
from app.services.llm_settings import (
    update_llm_config as write_llm_config,
)
from app.services.report_settings import (
    get_report_max_tokens,
    update_report_max_tokens,
)

router = APIRouter()


@router.get("/settings", response_model=UserSettingsRead, response_model_exclude_none=True)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsRead:
    """Return the current user's aggregated settings."""
    config = await _get_or_create_config(db, current_user)
    return await _settings_response(db, current_user, config)


@router.put("/settings", response_model=UserSettingsRead, response_model_exclude_none=True)
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
    config.report_frequencies = [frequency.value for frequency in payload.report_frequencies]
    config.markets = payload.markets
    config.categories = payload.categories
    config.is_active = payload.is_active
    config.time_ranges = _dump_time_ranges(payload.time_ranges)
    await update_report_max_tokens(db, current_user.id, payload.max_tokens)
    await db.commit()
    await db.refresh(current_user)
    await db.refresh(config)
    return await _settings_response(db, current_user, config)


@router.get("/report-config", response_model=UserReportConfigRead, response_model_exclude_none=True)
async def get_report_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserReportConfigRead:
    """Return the current user's report configuration."""
    config = await _get_or_create_config(db, current_user)
    return await _report_config_response(db, config)


@router.put("/report-config", response_model=UserReportConfigRead, response_model_exclude_none=True)
async def update_report_config(
    payload: UserReportConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserReportConfigRead:
    """Update the current user's report configuration."""
    config = await _get_or_create_config(db, current_user)
    config.report_frequency = payload.report_frequency
    config.report_frequencies = [frequency.value for frequency in payload.report_frequencies]
    config.markets = payload.markets
    config.categories = payload.categories
    config.is_active = payload.is_active
    config.time_ranges = _dump_time_ranges(payload.time_ranges)
    await update_report_max_tokens(db, current_user.id, payload.max_tokens)
    await db.commit()
    await db.refresh(config)
    return await _report_config_response(db, config)


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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LLMUsageResponse:
    """Return LLM usage rollups for any authenticated user."""
    return await read_llm_usage(db, current_user.id)


async def _get_or_create_config(db: AsyncSession, current_user: User) -> UserReportConfig:
    config = await db.scalar(
        select(UserReportConfig).where(UserReportConfig.user_id == current_user.id)
    )
    if config is not None:
        return config
    config = UserReportConfig(user_id=current_user.id)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


async def _settings_response(
    db: AsyncSession, user: User, config: UserReportConfig
) -> UserSettingsRead:
    return UserSettingsRead(
        display_name=user.display_name,
        locale=user.locale,
        data_retention_days=user.data_retention_days,
        report_frequency=config.report_frequency,
        report_frequencies=_report_frequencies(config),
        markets=[str(market) for market in config.markets],
        categories=[str(category) for category in config.categories],
        is_active=config.is_active,
        max_tokens=await get_report_max_tokens(db, user.id),
        time_ranges=config.time_ranges or {},
    )


async def _report_config_response(
    db: AsyncSession, config: UserReportConfig
) -> UserReportConfigRead:
    return UserReportConfigRead(
        report_frequency=config.report_frequency,
        report_frequencies=_report_frequencies(config),
        markets=[str(market) for market in config.markets],
        categories=[str(category) for category in config.categories],
        is_active=config.is_active,
        max_tokens=await get_report_max_tokens(db, config.user_id),
        time_ranges=config.time_ranges or {},
    )


def _report_frequencies(config: UserReportConfig) -> list[ReportType]:
    values = config.report_frequencies or [config.report_frequency.value]
    return [ReportType(value) for value in values]


def _dump_time_ranges(payload: dict[str, object]) -> dict[str, object]:
    return {
        key: value.model_dump(exclude_none=True) if hasattr(value, "model_dump") else value
        for key, value in payload.items()
    }
