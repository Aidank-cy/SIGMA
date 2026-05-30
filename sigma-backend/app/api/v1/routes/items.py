from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.item import ItemDetail, ItemListResponse
from app.services import item_service

router = APIRouter()


@router.get("", response_model=ItemListResponse)
async def list_items(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    since: datetime | None = None,
    category: str | None = None,
    market: str | None = None,
    source_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    keyword: str | None = None,
    format: str = Query(default="full", pattern="^(full|minimal)$"),
    db: AsyncSession = Depends(get_db),
) -> ItemListResponse:
    """Return collected items with standard pagination metadata."""
    return await item_service.list_items(
        db, page, page_size, since, category, market, source_id, date_from, date_to, keyword, format
    )


@router.get("/{item_id}", response_model=ItemDetail)
async def get_item(item_id: UUID, db: AsyncSession = Depends(get_db)) -> ItemDetail:
    """Return collected item detail with related items."""
    return await item_service.get_item(db, item_id)
