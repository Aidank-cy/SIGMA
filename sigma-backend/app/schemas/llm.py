from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


LLMProvider = Literal["anthropic", "openai", "deepseek", "minimax", "kimi", "gemini"]


class LLMApiKey(BaseModel):
    """Named API key entry for user-managed LLM credentials."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    key: str = Field(min_length=1, max_length=500)
    provider: LLMProvider
    token_limit: int = Field(gt=0)
    is_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def default_legacy_fields(cls, data: object) -> object:
        """Accept pre-provider key records saved before per-key limits existed."""
        if not isinstance(data, dict):
            return data
        return {
            "provider": "anthropic",
            "token_limit": 1_000_000,
            "is_default": False,
            **data,
        }


class LLMConfigRead(BaseModel):
    """Runtime LLM configuration payload."""

    model_config = ConfigDict(extra="forbid")

    daily_token_limit: int
    cost_guard_enabled: bool = True
    daily_token_limit_changed_at: datetime | None = None
    daily_token_limit_cooldown_remaining_seconds: int = 0
    api_keys: list[LLMApiKey] = Field(default_factory=list)


class LLMConfigUpdate(BaseModel):
    """Runtime LLM configuration update payload."""

    model_config = ConfigDict(extra="forbid")

    daily_token_limit: int = Field(default=1_000_000, gt=0)
    cost_guard_enabled: bool = True
    api_keys: list[LLMApiKey] = Field(default_factory=list, max_length=20)


class LLMUsageDay(BaseModel):
    """Daily LLM token usage rollup."""

    model_config = ConfigDict(extra="forbid")

    day: date
    function_type: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int


class LLMUsageResponse(BaseModel):
    """LLM usage stats response."""

    model_config = ConfigDict(extra="forbid")

    items: list[LLMUsageDay]
