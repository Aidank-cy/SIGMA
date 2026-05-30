from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.admin import (
    AdminUserListResponse,
    AdminUserRead,
    AdminUserReportConfigUpdate,
    AdminUserUpdate,
)
from app.schemas.llm import LLMConfigRead, LLMConfigUpdate, LLMUsageResponse
from app.schemas.source import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
    SourceListResponse,
)
from app.schemas.user_settings import UserReportConfigRead
from app.services import admin_service, admin_source_service

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
    return await admin_service.list_admin_users(db, page, page_size, q)


@router.put("/{user_id}", response_model=AdminUserRead)
async def update_admin_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminUserRead:
    """Update another user's role or active status."""
    return await admin_service.update_admin_user(db, user_id, payload, current_admin.id)


@router.get("/{user_id}/llm/config", response_model=LLMConfigRead)
async def get_admin_user_llm_config(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Return a user's LLM settings for admin management."""
    return await admin_service.get_admin_user_llm_config(db, user_id)


@router.put("/{user_id}/llm/config", response_model=LLMConfigRead)
async def update_admin_user_llm_config(
    user_id: UUID,
    payload: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Update a user's LLM settings for admin management."""
    return await admin_service.update_admin_user_llm_config(db, user_id, payload)


@router.get("/{user_id}/llm/usage", response_model=LLMUsageResponse)
async def get_admin_user_llm_usage(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMUsageResponse:
    """Return a user's LLM usage totals for admin detail panels."""
    return await admin_service.get_admin_user_llm_usage(db, user_id)


@router.get(
    "/{user_id}/report-config",
    response_model=UserReportConfigRead,
    response_model_exclude_none=True,
)
async def get_admin_user_report_config(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserReportConfigRead:
    """Return a user's scheduled report configuration for admin management."""
    return await admin_service.get_admin_user_report_config(db, user_id)


@router.put(
    "/{user_id}/report-config",
    response_model=UserReportConfigRead,
    response_model_exclude_none=True,
)
async def update_admin_user_report_config(
    user_id: UUID,
    payload: AdminUserReportConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserReportConfigRead:
    """Update a user's scheduled report configuration."""
    return await admin_service.update_admin_user_report_config(db, user_id, payload)


@router.get("/{user_id}/sources", response_model=SourceListResponse)
async def list_admin_user_sources(
    user_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SourceListResponse:
    """List custom data sources owned by another user."""
    return await admin_source_service.list_admin_user_sources(
        db, user_id, page, page_size, current_admin.id
    )


@router.post(
    "/{user_id}/sources", response_model=DataSourceRead, status_code=status.HTTP_201_CREATED
)
async def create_admin_user_source(
    user_id: UUID,
    payload: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> DataSourceRead:
    """Create a custom data source owned by another user."""
    return await admin_source_service.create_admin_user_source(
        db, user_id, payload, current_admin.id
    )


@router.put("/{user_id}/sources/{source_id}", response_model=DataSourceRead)
async def update_admin_user_source(
    user_id: UUID,
    source_id: UUID,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> DataSourceRead:
    """Update a custom data source owned by another user."""
    return await admin_source_service.update_admin_user_source(
        db, user_id, source_id, payload, current_admin.id
    )


@router.delete("/{user_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user_source(
    user_id: UUID,
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    """Delete a custom data source and its collected rows for another user."""
    await admin_source_service.delete_admin_user_source(db, user_id, source_id, current_admin.id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    """Delete another user and user-owned records."""
    await admin_service.delete_admin_user(db, user_id, current_admin.id)
