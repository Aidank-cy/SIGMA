from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database import get_db
from app.middleware.auth import require_role
from app.models.enums import UserRole
from app.models.llm_usage_log import LLMUsageLog
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.llm import LLMConfigRead, LLMConfigUpdate, LLMUsageDay, LLMUsageResponse

router = APIRouter()


@router.get("/config", response_model=LLMConfigRead)
async def get_llm_config(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Return runtime LLM provider, model, and budget settings."""
    return LLMConfigRead(
        provider=str(await _config_value(db, "sigma.llm.provider", settings.default_llm_provider)),
        model=str(await _config_value(db, "sigma.llm.model", settings.default_llm_model)),
        daily_token_limit=int(
            await _config_value(db, "sigma.llm.daily_token_limit", settings.daily_token_limit)
        ),
    )


@router.put("/config", response_model=LLMConfigRead)
async def update_llm_config(
    payload: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMConfigRead:
    """Update runtime LLM provider, model, and budget settings."""
    await _upsert_config(db, "sigma.llm.provider", payload.provider)
    await _upsert_config(db, "sigma.llm.model", payload.model)
    await _upsert_config(db, "sigma.llm.daily_token_limit", payload.daily_token_limit)
    await db.commit()
    return LLMConfigRead(
        provider=payload.provider,
        model=payload.model,
        daily_token_limit=payload.daily_token_limit,
    )


@router.get("/usage", response_model=LLMUsageResponse)
async def get_llm_usage(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> LLMUsageResponse:
    """Return LLM usage totals grouped by day and function type."""
    day_expr = func.date(LLMUsageLog.created_at)
    rows = await db.execute(
        select(
            day_expr.label("day"),
            LLMUsageLog.function_type,
            func.sum(LLMUsageLog.input_tokens).label("input_tokens"),
            func.sum(LLMUsageLog.output_tokens).label("output_tokens"),
        )
        .group_by(day_expr, LLMUsageLog.function_type)
        .order_by(day_expr.desc())
    )
    items = [
        LLMUsageDay(
            day=date.fromisoformat(str(row.day)),
            function_type=row.function_type.value,
            input_tokens=int(row.input_tokens or 0),
            output_tokens=int(row.output_tokens or 0),
            total_tokens=int((row.input_tokens or 0) + (row.output_tokens or 0)),
        )
        for row in rows
    ]
    return LLMUsageResponse(items=items)


async def _config_value(db: AsyncSession, key: str, default: object) -> object:
    config = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    if config is None:
        return default
    return config.value.get("value", default)


async def _upsert_config(db: AsyncSession, key: str, value: object) -> None:
    config = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    if config is None:
        db.add(SystemConfig(key=key, value={"value": value}))
        return
    config.value = {"value": value}
