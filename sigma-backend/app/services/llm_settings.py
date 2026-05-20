from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.llm_usage_log import LLMUsageLog
from app.models.system_config import SystemConfig
from app.schemas.llm import LLMApiKey, LLMConfigRead, LLMConfigUpdate, LLMUsageDay, LLMUsageResponse


async def get_llm_config(db: AsyncSession, user_id: UUID | None = None) -> LLMConfigRead:
    """Return runtime LLM provider, model, and budget settings."""
    return LLMConfigRead(
        provider=str(await _config_value(db, "sigma.llm.provider", settings.default_llm_provider)),
        model=str(await _config_value(db, "sigma.llm.model", settings.default_llm_model)),
        daily_token_limit=int(await _config_value(db, "sigma.llm.daily_token_limit", settings.daily_token_limit)),
        cost_guard_enabled=bool(await _config_value(db, "sigma.llm.cost_guard_enabled", True)),
        api_keys=await _api_keys_value(db, user_id),
    )


async def update_llm_config(db: AsyncSession, payload: LLMConfigUpdate, user_id: UUID | None = None) -> LLMConfigRead:
    """Update runtime LLM provider, model, and budget settings."""
    await _upsert_config(db, "sigma.llm.provider", payload.provider)
    await _upsert_config(db, "sigma.llm.model", payload.model)
    await _upsert_config(db, "sigma.llm.daily_token_limit", payload.daily_token_limit)
    await _upsert_config(db, "sigma.llm.cost_guard_enabled", payload.cost_guard_enabled)
    await _upsert_config(
        db,
        _api_keys_config_key(user_id),
        [entry.model_dump() for entry in payload.api_keys],
    )
    await db.commit()
    return LLMConfigRead(
        provider=payload.provider,
        model=payload.model,
        daily_token_limit=payload.daily_token_limit,
        cost_guard_enabled=payload.cost_guard_enabled,
        api_keys=payload.api_keys,
    )


async def get_llm_usage(db: AsyncSession) -> LLMUsageResponse:
    """Return LLM usage totals grouped by day, function, provider, and model."""
    day_expr = func.date(LLMUsageLog.created_at)
    rows = await db.execute(
        select(
            day_expr.label("day"),
            LLMUsageLog.function_type,
            LLMUsageLog.provider,
            LLMUsageLog.model,
            func.sum(LLMUsageLog.input_tokens).label("input_tokens"),
            func.sum(LLMUsageLog.output_tokens).label("output_tokens"),
        )
        .group_by(day_expr, LLMUsageLog.function_type, LLMUsageLog.provider, LLMUsageLog.model)
        .order_by(day_expr.desc())
    )
    items = [
        LLMUsageDay(
            day=date.fromisoformat(str(row.day)),
            function_type=row.function_type.value,
            provider=row.provider,
            model=row.model,
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


async def _api_keys_value(db: AsyncSession, user_id: UUID | None) -> list[LLMApiKey]:
    raw_value = await _config_value(db, _api_keys_config_key(user_id), [])
    if not isinstance(raw_value, list):
        return []
    entries: list[LLMApiKey] = []
    for item in raw_value:
        if isinstance(item, dict):
            entries.append(LLMApiKey.model_validate(item))
    return entries


def _api_keys_config_key(user_id: UUID | None) -> str:
    if user_id is None:
        return "sigma.llm.api_keys"
    return f"sigma.user.{user_id}.llm.api_keys"
