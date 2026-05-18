from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class LLMApiKey(BaseModel):
    """Named API key entry for user-managed LLM credentials."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    key: str = Field(min_length=1, max_length=500)


class LLMConfigRead(BaseModel):
    """Runtime LLM configuration payload."""

    model_config = ConfigDict(extra="forbid")

    provider: str
    model: str
    daily_token_limit: int
    cost_guard_enabled: bool = True
    api_keys: list[LLMApiKey] = Field(default_factory=list)


class LLMConfigUpdate(BaseModel):
    """Runtime LLM configuration update payload."""

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(pattern="^(anthropic|openai)$")
    model: str = Field(min_length=1, max_length=160)
    daily_token_limit: int = Field(gt=0)
    cost_guard_enabled: bool = True
    api_keys: list[LLMApiKey] = Field(default_factory=list, max_length=20)


class LLMUsageDay(BaseModel):
    """Daily LLM token usage rollup."""

    model_config = ConfigDict(extra="forbid")

    day: date
    function_type: str
    input_tokens: int
    output_tokens: int
    total_tokens: int


class LLMUsageResponse(BaseModel):
    """LLM usage stats response."""

    model_config = ConfigDict(extra="forbid")

    items: list[LLMUsageDay]
