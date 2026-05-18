from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.seeds import seed_data_sources
from app.models.data_source import DataSource
from app.models.enums import Market
from scripts.seed_demo_data import ITEM_SPECS, article_body, summary_for


async def test_seed_data_sources_creates_eight_sources(db_session: AsyncSession) -> None:
    """Seed helper inserts eight MVP system sources into an empty table."""
    created = await seed_data_sources(db_session)
    total = await db_session.scalar(select(func.count()).select_from(DataSource))

    assert created == 8
    assert total == 8


def test_demo_item_specs_include_content_length_variety_per_market() -> None:
    """Demo item specs provide short, medium, and long article bodies."""
    lengths_by_market: dict[str, set[str]] = {}
    for category, market, title, keywords, sentiment, content_length in ITEM_SPECS:
        assert category
        assert title
        assert keywords
        assert sentiment in {"bullish", "bearish", "neutral"}
        assert content_length in {"short", "medium", "long"}
        lengths_by_market.setdefault(market.value, set()).add(content_length)

    for market in [Market.US, Market.CN, Market.JP, Market.EU, Market.HK, Market.GLOBAL]:
        assert lengths_by_market[market.value] == {"short", "medium", "long"}


def test_demo_article_body_lengths_are_visibly_distinct() -> None:
    """Generated demo item bodies differ enough to exercise frontend layouts."""
    category, market, title, keywords, sentiment, _content_length = ITEM_SPECS[0]

    short = article_body(title, category, market, keywords, "short")
    medium = article_body(title, category, market, keywords, "medium")
    long = article_body(title, category, market, keywords, "long")

    assert len(short.split()) < len(medium.split()) < len(long.split())
    assert len(summary_for(title, market, sentiment, "short").split()) < len(
        summary_for(title, market, sentiment, "long").split()
    )
