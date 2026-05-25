from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.factory import create_collector
from app.database import get_db
from app.middleware.auth import require_role
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import UserRole
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.models.watchlist import Watchlist
from app.scheduler.engine import add_or_update_source_job, remove_source_job
from app.schemas.admin import AdminUserListResponse, AdminUserRead, AdminUserReportConfigUpdate, AdminUserUpdate
from app.schemas.llm import LLMConfigRead, LLMConfigUpdate
from app.schemas.source import DataSourceCreate, DataSourceRead, DataSourceUpdate, SourceListResponse
from app.schemas.user_settings import UserReportConfigRead
from app.services.llm_settings import get_llm_config, update_llm_config

router = APIRouter()


@router.get("", response_model=AdminUserListResponse)
async def list_admin_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None, max_length=120),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
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
    items: list[AdminUserRead] = []
    for user in users:
        llm_config = await get_llm_config(db, user.id)
        items.append(
            AdminUserRead.model_validate(
                {
                    **user.__dict__,
                    "llm_key_count": len(llm_config.api_keys),
                    "source_count": source_counts.get(user.id, 0),
                }
            )
        )
    return AdminUserListResponse(
        page=page,
        page_size=page_size,
        total=total or 0,
        has_next=(page * page_size) < (total or 0),
        items=items,
    )


@router.put("/{user_id}", response_model=AdminUserRead)
async def update_admin_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminUserRead:
    """Update another user's role or active status."""
    if user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify self")
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


@router.get("/{user_id}/llm/config", response_model=LLMConfigRead)
async def get_admin_user_llm_config(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Return another user's LLM settings for admin management."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    return await get_llm_config(db, user_id)


@router.put("/{user_id}/llm/config", response_model=LLMConfigRead)
async def update_admin_user_llm_config(
    user_id: UUID,
    payload: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Update another user's LLM settings for admin management."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    return await update_llm_config(db, payload, user_id)


@router.get("/{user_id}/report-config", response_model=UserReportConfigRead)
async def get_admin_user_report_config(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserReportConfigRead:
    """Return another user's scheduled report configuration for admin management."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    config = await _get_or_create_report_config(db, user_id)
    return UserReportConfigRead.model_validate(config)


@router.put("/{user_id}/report-config", response_model=UserReportConfigRead)
async def update_admin_user_report_config(
    user_id: UUID,
    payload: AdminUserReportConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserReportConfigRead:
    """Update another user's scheduled report generation state."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    config = await _get_or_create_report_config(db, user_id)
    config.is_active = payload.is_active
    await db.commit()
    await db.refresh(config)
    return UserReportConfigRead.model_validate(config)


@router.get("/{user_id}/sources", response_model=SourceListResponse)
async def list_admin_user_sources(
    user_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SourceListResponse:
    """List custom data sources owned by another user."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    predicate = (DataSource.created_by == user_id, DataSource.is_system.is_(False))
    total = await db.scalar(select(func.count()).select_from(DataSource).where(*predicate))
    sources = list(
        await db.scalars(
            select(DataSource)
            .where(*predicate)
            .order_by(DataSource.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    total_value = total or 0
    return SourceListResponse(
        page=page,
        page_size=page_size,
        total=total_value,
        has_next=(page * page_size) < total_value,
        items=[DataSourceRead.model_validate(source) for source in sources],
    )


@router.post("/{user_id}/sources", response_model=DataSourceRead, status_code=status.HTTP_201_CREATED)
async def create_admin_user_source(
    user_id: UUID,
    payload: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> DataSourceRead:
    """Create a custom data source owned by another user."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    source = DataSource(**payload.model_dump(), created_by=user_id, is_system=False)
    await _validate_source(source)
    db.add(source)
    await db.commit()
    await db.refresh(source)
    if source.is_active:
        add_or_update_source_job(source)
    return DataSourceRead.model_validate(source)


@router.put("/{user_id}/sources/{source_id}", response_model=DataSourceRead)
async def update_admin_user_source(
    user_id: UUID,
    source_id: UUID,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> DataSourceRead:
    """Update a custom data source owned by another user."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    source = await _get_user_source(db, user_id, source_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, key, value)
    await _validate_source(source)
    await db.commit()
    await db.refresh(source)
    if source.is_active:
        add_or_update_source_job(source)
    else:
        remove_source_job(source.id)
    return DataSourceRead.model_validate(source)


@router.delete("/{user_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user_source(
    user_id: UUID,
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    """Delete a custom data source and its collected rows for another user."""
    _ensure_not_self(user_id, current_admin.id)
    await _get_user(db, user_id)
    source = await _get_user_source(db, user_id, source_id)
    deleted_source_id = source.id
    await db.execute(delete(CollectorLog).where(CollectorLog.source_id == source.id))
    await db.execute(delete(CollectedItem).where(CollectedItem.source_id == source.id))
    await db.delete(source)
    await db.commit()
    remove_source_job(deleted_source_id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    """Delete another user and user-owned records."""
    if user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete self")
    user = await _get_user(db, user_id)
    if user.role == UserRole.ADMIN:
        await _ensure_not_last_admin(db, user.id)
    await db.execute(delete(Watchlist).where(Watchlist.user_id == user.id))
    await db.execute(delete(UserReportConfig).where(UserReportConfig.user_id == user.id))
    await db.execute(update(DataSource).where(DataSource.created_by == user.id).values(created_by=None))
    await db.delete(user)
    await db.commit()


async def _get_user(db: AsyncSession, user_id: UUID) -> User:
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def _get_user_source(db: AsyncSession, user_id: UUID, source_id: UUID) -> DataSource:
    source = await db.scalar(
        select(DataSource).where(
            DataSource.id == source_id,
            DataSource.created_by == user_id,
            DataSource.is_system.is_(False),
        )
    )
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    return source


async def _get_or_create_report_config(db: AsyncSession, user_id: UUID) -> UserReportConfig:
    config = await db.scalar(select(UserReportConfig).where(UserReportConfig.user_id == user_id))
    if config is not None:
        return config
    config = UserReportConfig(user_id=user_id)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


def _ensure_not_self(user_id: UUID, current_admin_id: UUID) -> None:
    if user_id == current_admin_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify self")


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


async def _validate_source(source: DataSource) -> None:
    collector = create_collector(source)
    if not await collector.validate_config():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid config for {source.source_type} source: check required fields",
        )


async def _ensure_not_last_admin(db: AsyncSession, excluding_user_id: UUID) -> None:
    admin_count = await db.scalar(
        select(func.count()).select_from(User).where(
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
            User.id != excluding_user_id,
        )
    )
    if (admin_count or 0) < 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot remove last admin")
