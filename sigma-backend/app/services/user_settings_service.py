from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReportType
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.schemas.auth import UserResponse
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
from app.services.report_settings import get_report_max_tokens, update_report_max_tokens


async def get_settings(db: AsyncSession, current_user: User) -> UserSettingsRead:
    """Return the current user's aggregated settings."""
    config = await _get_or_create_config(db, current_user)
    return await _settings_response(db, current_user, config)


async def update_settings(
    db: AsyncSession, current_user: User, payload: UserSettingsUpdate
) -> UserSettingsRead:
    """Update the current user's profile, retention, and report settings together."""
    config = await _get_or_create_config(db, current_user)
    current_user.display_name = payload.display_name
    current_user.locale = payload.locale
    current_user.data_retention_days = payload.data_retention_days
    _apply_report_config(config, payload)
    await update_report_max_tokens(db, current_user.id, payload.max_tokens)
    await db.commit()
    await db.refresh(current_user)
    await db.refresh(config)
    return await _settings_response(db, current_user, config)


async def get_report_config(db: AsyncSession, current_user: User) -> UserReportConfigRead:
    """Return the current user's report configuration."""
    config = await _get_or_create_config(db, current_user)
    return await _report_config_response(db, config)


async def update_report_config(
    db: AsyncSession, current_user: User, payload: UserReportConfigUpdate
) -> UserReportConfigRead:
    """Update the current user's report configuration."""
    config = await _get_or_create_config(db, current_user)
    _apply_report_config(config, payload)
    await update_report_max_tokens(db, current_user.id, payload.max_tokens)
    await db.commit()
    await db.refresh(config)
    return await _report_config_response(db, config)


async def update_profile(
    db: AsyncSession, current_user: User, payload: UserProfileUpdate
) -> UserResponse:
    """Update the current user's profile settings."""
    current_user.display_name = payload.display_name
    current_user.locale = payload.locale
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


async def update_retention(
    db: AsyncSession, current_user: User, payload: UserRetentionUpdate
) -> UserResponse:
    """Update the current user's data retention preference."""
    current_user.data_retention_days = payload.data_retention_days
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


async def update_password(
    db: AsyncSession, current_user: User, payload: UserPasswordUpdate
) -> None:
    """Update the current user's password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()


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


def _apply_report_config(
    config: UserReportConfig, payload: UserSettingsUpdate | UserReportConfigUpdate
) -> None:
    config.report_frequency = payload.report_frequency
    config.report_frequencies = [frequency.value for frequency in payload.report_frequencies]
    config.markets = payload.markets
    config.categories = payload.categories
    config.is_active = payload.is_active
    config.time_ranges = _dump_time_ranges(payload.time_ranges)


def _report_frequencies(config: UserReportConfig) -> list[ReportType]:
    values = config.report_frequencies or [config.report_frequency.value]
    return [ReportType(value) for value in values]


def _dump_time_ranges(payload: dict[str, object]) -> dict[str, object]:
    return {
        key: value.model_dump(exclude_none=True) if hasattr(value, "model_dump") else value
        for key, value in payload.items()
    }
