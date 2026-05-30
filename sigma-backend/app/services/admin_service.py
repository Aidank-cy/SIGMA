from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_source import DataSource
from app.models.enums import ReportType, UserRole
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.models.watchlist import Watchlist
from app.schemas.admin import (
    AdminUserListResponse,
    AdminUserRead,
    AdminUserReportConfigUpdate,
    AdminUserUpdate,
)
from app.schemas.llm import LLMConfigRead, LLMConfigUpdate, LLMUsageResponse
from app.schemas.user_settings import UserReportConfigRead
from app.services.llm_settings import get_llm_config, get_llm_usage, update_llm_config
from app.services.report_settings import get_report_max_tokens, update_report_max_tokens


async def list_admin_users(
    db: AsyncSession, page: int, page_size: int, q: str | None
) -> AdminUserListResponse:
    """List users for admin management."""
    predicate = []
    if q:
        pattern = f"%{q.strip()}%"
        predicate.append(or_(User.email.ilike(pattern), User.display_name.ilike(pattern)))
    total = await db.scalar(select(func.count()).select_from(User).where(*predicate))
    users = list(
        await db.scalars(
            select(User)
            .where(*predicate)
            .order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    source_counts = await _source_counts(db, [user.id for user in users])
    items = [await _admin_user_read(db, user, source_counts.get(user.id, 0)) for user in users]
    return AdminUserListResponse(
        page=page,
        page_size=page_size,
        total=total or 0,
        has_next=(page * page_size) < (total or 0),
        items=items,
    )


async def update_admin_user(
    db: AsyncSession,
    user_id: UUID,
    payload: AdminUserUpdate,
    current_admin_id: UUID,
) -> AdminUserRead:
    """Update another user's role or active status."""
    _ensure_not_self(user_id, current_admin_id)
    user = await _get_user(db, user_id)
    if user.role == UserRole.ADMIN and payload.role == UserRole.USER:
        await _ensure_not_last_admin(db, user.id)
    if user.role == UserRole.ADMIN and payload.is_active is False:
        await _ensure_not_last_admin(db, user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return AdminUserRead.model_validate(user)


async def get_admin_user_llm_config(db: AsyncSession, user_id: UUID) -> LLMConfigRead:
    """Return a user's LLM settings for admin management."""
    await _get_user(db, user_id)
    return await get_llm_config(db, user_id)


async def update_admin_user_llm_config(
    db: AsyncSession, user_id: UUID, payload: LLMConfigUpdate
) -> LLMConfigRead:
    """Update a user's LLM settings for admin management."""
    await _get_user(db, user_id)
    return await update_llm_config(db, payload, user_id, bypass_cooldown=True)


async def get_admin_user_llm_usage(db: AsyncSession, user_id: UUID) -> LLMUsageResponse:
    """Return a user's LLM usage totals for admin detail panels."""
    await _get_user(db, user_id)
    return await get_llm_usage(db, user_id)


async def get_admin_user_report_config(db: AsyncSession, user_id: UUID) -> UserReportConfigRead:
    """Return a user's scheduled report configuration for admin management."""
    await _get_user(db, user_id)
    config = await _get_or_create_report_config(db, user_id)
    return await _report_config_response(db, config)


async def update_admin_user_report_config(
    db: AsyncSession,
    user_id: UUID,
    payload: AdminUserReportConfigUpdate,
) -> UserReportConfigRead:
    """Update a user's scheduled report configuration."""
    await _get_user(db, user_id)
    config = await _get_or_create_report_config(db, user_id)
    if payload.report_frequencies is not None:
        frequencies = payload.report_frequencies or [
            payload.report_frequency or config.report_frequency
        ]
        config.report_frequency = frequencies[0]
        config.report_frequencies = [frequency.value for frequency in frequencies]
    elif payload.report_frequency is not None:
        config.report_frequency = payload.report_frequency
        config.report_frequencies = [payload.report_frequency.value]
    if payload.markets is not None:
        config.markets = payload.markets
    if payload.categories is not None:
        config.categories = payload.categories
    if payload.is_active is not None:
        config.is_active = payload.is_active
    if payload.max_tokens:
        await update_report_max_tokens(db, user_id, payload.max_tokens)
    if "time_ranges" in payload.model_fields_set:
        config.time_ranges = _dump_time_ranges(payload.time_ranges)
    await db.commit()
    await db.refresh(config)
    return await _report_config_response(db, config)


async def delete_admin_user(db: AsyncSession, user_id: UUID, current_admin_id: UUID) -> None:
    """Delete another user and user-owned records."""
    _ensure_not_self_delete(user_id, current_admin_id)
    user = await _get_user(db, user_id)
    if user.role == UserRole.ADMIN:
        await _ensure_not_last_admin(db, user.id)
    await db.execute(delete(Watchlist).where(Watchlist.user_id == user.id))
    await db.execute(delete(UserReportConfig).where(UserReportConfig.user_id == user.id))
    await db.execute(
        update(DataSource).where(DataSource.created_by == user.id).values(created_by=None)
    )
    await db.delete(user)
    await db.commit()


async def _admin_user_read(db: AsyncSession, user: User, source_count: int = 0) -> AdminUserRead:
    llm_config = await get_llm_config(db, user.id)
    return AdminUserRead.model_validate(
        {
            **user.__dict__,
            "llm_key_count": len(llm_config.api_keys),
            "source_count": source_count,
        }
    )


async def _get_user(db: AsyncSession, user_id: UUID) -> User:
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def _get_or_create_report_config(db: AsyncSession, user_id: UUID) -> UserReportConfig:
    config = await db.scalar(select(UserReportConfig).where(UserReportConfig.user_id == user_id))
    if config is not None:
        return config
    config = UserReportConfig(user_id=user_id)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


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


def _dump_time_ranges(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value.model_dump(exclude_none=True) if hasattr(value, "model_dump") else value
        for key, value in payload.items()
    }


def _ensure_not_self(user_id: UUID, current_admin_id: UUID) -> None:
    if user_id == current_admin_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify self")


def _ensure_not_self_delete(user_id: UUID, current_admin_id: UUID) -> None:
    if user_id == current_admin_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete self")


async def _source_counts(db: AsyncSession, user_ids: list[UUID]) -> dict[UUID, int]:
    if not user_ids:
        return {}
    rows = await db.execute(
        select(DataSource.created_by, func.count(DataSource.id))
        .where(
            DataSource.created_by.in_(user_ids),
            DataSource.is_system.is_(False),
        )
        .group_by(DataSource.created_by)
    )
    return {row[0]: int(row[1] or 0) for row in rows if row[0] is not None}


async def _ensure_not_last_admin(db: AsyncSession, excluding_user_id: UUID) -> None:
    admin_count = await db.scalar(
        select(func.count())
        .select_from(User)
        .where(
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
            User.id != excluding_user_id,
        )
    )
    if (admin_count or 0) < 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot remove last admin")
