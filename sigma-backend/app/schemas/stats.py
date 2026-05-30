from pydantic import BaseModel, ConfigDict, Field


class SentimentStatsResponse(BaseModel):
    """Homepage sentiment aggregate."""

    model_config = ConfigDict(extra="forbid")

    bullish_pct: int = Field(ge=0, le=100)


class TrendingKeyword(BaseModel):
    """Keyword mention count."""

    model_config = ConfigDict(extra="forbid")

    keyword: str = Field(min_length=1, max_length=120)
    count: int = Field(ge=0)


class TrendingKeywordsResponse(BaseModel):
    """Top recent keyword mentions."""

    model_config = ConfigDict(extra="forbid")

    items: list[TrendingKeyword]


class LastCollectionResponse(BaseModel):
    """Latest successful collection timestamp."""

    model_config = ConfigDict(extra="forbid")

    last_success: str | None
