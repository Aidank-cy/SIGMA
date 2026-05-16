from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.schemas.user_settings import UserReportConfigRead, UserReportConfigUpdate

router = APIRouter()


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


async def _get_or_create_config(db: AsyncSession, current_user: User) -> UserReportConfig:
    config = await db.scalar(select(UserReportConfig).where(UserReportConfig.user_id == current_user.id))
    if config is not None:
        return config
    config = UserReportConfig(user_id=current_user.id)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config
