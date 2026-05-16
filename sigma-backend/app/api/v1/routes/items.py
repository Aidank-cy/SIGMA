from datetime import datetime

from fastapi import APIRouter, Query

from app.schemas.items import ItemListResponse

router = APIRouter()


@router.get("", response_model=ItemListResponse)
async def list_items(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    since: datetime | None = None,
    format: str = Query(default="full", pattern="^(full|minimal)$"),
) -> ItemListResponse:
    """Return collected items with standard pagination metadata."""
    return ItemListResponse(page=page, page_size=page_size, total=0, has_next=False, items=[])
