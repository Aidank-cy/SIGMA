from pydantic import BaseModel, ConfigDict


class SentimentStatsResponse(BaseModel):
    """Homepage sentiment aggregate."""

    model_config = ConfigDict(extra="forbid")

    bullish_pct: int


class TrendingKeyword(BaseModel):
    """Keyword mention count."""

    model_config = ConfigDict(extra="forbid")

    keyword: str
    count: int


class TrendingKeywordsResponse(BaseModel):
    """Top recent keyword mentions."""

    model_config = ConfigDict(extra="forbid")

    items: list[TrendingKeyword]
