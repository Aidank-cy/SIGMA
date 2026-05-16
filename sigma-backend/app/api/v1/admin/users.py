from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.data_source import DataSource
from app.models.enums import UserRole
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.models.watchlist import Watchlist
from app.schemas.admin import AdminUserListResponse, AdminUserRead, AdminUserUpdate

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
    return AdminUserListResponse(
        page=page,
        page_size=page_size,
        total=total or 0,
        has_next=(page * page_size) < (total or 0),
        items=[AdminUserRead.model_validate(user) for user in users],
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
