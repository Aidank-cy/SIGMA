"""Seed deterministic data for Playwright frontend integration tests.

Run from the repository root via the frontend Playwright global setup, or manually:
    DATABASE_URL=postgresql+asyncpg://sigma:sigma@localhost:5432/sigma \
    python3 sigma-backend/scripts/seed_e2e_data.py
"""

from __future__ import annotations

# ruff: noqa: E402
import asyncio
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import AsyncSessionLocal, engine
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import (
    CollectorStatus,
    IntelligenceCategory,
    LLMFunctionType,
    Market,
    ReportType,
    SourceType,
    UserLocale,
    UserRole,
)
from app.models.llm_usage_log import LLMUsageLog
from app.models.report import Report
from app.models.system_config import SystemConfig
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.models.watchlist import Watchlist
from app.schemas.market import (
    MarketIndex,
    MarketIndicesResponse,
    MarketSparkline,
    TradingHours,
    TradingSession,
)
from app.services.auth_service import hash_password
from app.services.market.config import CACHE_KEY, INDEX_CONFIGS
from app.services.market.indices import _is_trading, _now_utc, _sessions_to_beijing
from app.utils.redis_lock import create_redis_client

PASSWORD = "StrongPass1"
ADMIN_EMAIL = "e2e-admin@sigma-e2e.com"
SETTINGS_ADMIN_EMAIL = "e2e-settings-admin@sigma-e2e.com"
USER_EMAIL = "e2e-user@sigma-e2e.com"
LEGACY_EMAILS = ["e2e-admin@sigma.test", "e2e-user@sigma.test"]
PREFIX = "E2E"


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await _cleanup(db)
        admin = await _create_user(db, ADMIN_EMAIL, "E2E Admin", UserRole.ADMIN, UserLocale.EN)
        settings_admin = await _create_user(
            db,
            SETTINGS_ADMIN_EMAIL,
            "E2E Settings Admin",
            UserRole.ADMIN,
            UserLocale.EN,
        )
        user = await _create_user(db, USER_EMAIL, "E2E Analyst", UserRole.USER, UserLocale.EN)
        source = _source(admin.id)
        db.add(source)
        await db.flush()
        db.add_all(_items(source.id))
        db.add_all(_reports())
        db.add_all(_watchlists([admin.id, settings_admin.id, user.id], source.id))
        db.add_all(_logs(source.id))
        db.add_all(_llm_usage())
        db.add(
            UserReportConfig(
                user_id=user.id,
                report_frequency=ReportType.DAILY,
                markets=["us"],
                categories=["finance"],
            )
        )
        await _upsert_config(db, "sigma.llm.provider", "openai")
        await _upsert_config(db, "sigma.llm.model", "gpt-4.1-mini")
        await _upsert_config(db, "sigma.llm.daily_token_limit", 100000)
        await _upsert_config(db, "sigma.llm.cost_guard_enabled", True)
        await db.commit()
    await _clear_e2e_caches()
    await _seed_market_indices_cache()
    await engine.dispose()


async def _cleanup(db) -> None:
    e2e_source_ids = list(
        await db.scalars(select(DataSource.id).where(DataSource.name.like(f"{PREFIX}%")))
    )
    e2e_user_ids = list(
        await db.scalars(
            select(User.id).where(
                User.email.in_([ADMIN_EMAIL, SETTINGS_ADMIN_EMAIL, USER_EMAIL, *LEGACY_EMAILS])
            )
        )
    )
    if e2e_source_ids:
        await db.execute(delete(CollectedItem).where(CollectedItem.source_id.in_(e2e_source_ids)))
        await db.execute(delete(CollectorLog).where(CollectorLog.source_id.in_(e2e_source_ids)))
        await db.execute(delete(DataSource).where(DataSource.id.in_(e2e_source_ids)))
    if e2e_user_ids:
        await db.execute(delete(Watchlist).where(Watchlist.user_id.in_(e2e_user_ids)))
        await db.execute(delete(UserReportConfig).where(UserReportConfig.user_id.in_(e2e_user_ids)))
        await db.execute(
            update(DataSource)
            .where(DataSource.created_by.in_(e2e_user_ids))
            .values(created_by=None)
        )
        await db.execute(delete(User).where(User.id.in_(e2e_user_ids)))
    await db.execute(delete(Report).where(Report.title.like(f"{PREFIX}%")))
    await db.execute(delete(LLMUsageLog).where(LLMUsageLog.model.in_(["gpt-e2e", "gpt-4.1-mini"])))
    await db.execute(delete(SystemConfig).where(SystemConfig.key.like("sigma.user.%")))
    await db.commit()


async def _create_user(
    db, email: str, display_name: str, role: UserRole, locale: UserLocale
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(PASSWORD),
        display_name=display_name,
        role=role,
        locale=locale,
        data_retention_days=30,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


def _source(user_id: UUID) -> DataSource:
    return DataSource(
        id=uuid4(),
        name="E2E API Source",
        source_type=SourceType.API,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={
            "base_url": "https://example.test",
            "field_mapping": {"title": "title", "content": "content", "content_url": "url"},
        },
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
        is_system=False,
        is_active=True,
        created_by=user_id,
    )


def _items(source_id: UUID) -> list[CollectedItem]:
    now = datetime.now(UTC)
    items: list[CollectedItem] = []
    blueprints: list[tuple[IntelligenceCategory, Market, str]] = [
        (IntelligenceCategory.FINANCE, Market.US, "E2E AI stock rally"),
        (IntelligenceCategory.FINANCE, Market.US, "E2E finance stock earnings"),
        (IntelligenceCategory.POLITICS, Market.CN, "E2E China policy briefing"),
        (IntelligenceCategory.TECHNOLOGY, Market.US, "E2E chip demand growth"),
        (IntelligenceCategory.MACRO, Market.EU, "E2E inflation risk watch"),
    ]
    for index in range(45):
        category, market, seed_title = blueprints[index % len(blueprints)]
        title = f"{seed_title} #{index + 1:02d}"
        sentiment = "bullish" if index % 3 == 0 else "bearish" if index % 3 == 1 else "neutral"
        items.append(
            CollectedItem(
                source_id=source_id,
                title=title,
                content_raw=(
                    f"{title}. Full E2E article content with AI, stock, finance, policy, "
                    "and market context. "
                    "This paragraph gives the detail page enough body content to render."
                ),
                content_url=f"https://e2e.sigma.test/items/{index + 1}",
                summary=f"{title} summary for Playwright integration coverage.",
                category=category,
                market=market,
                published_at=now - timedelta(minutes=index * 7),
                collected_at=now - timedelta(minutes=index * 7),
                expires_at=now + timedelta(days=30),
                metadata_extra={"sentiment": sentiment, "keywords": ["AI", "stocks", "E2E"]},
            )
        )
    return items


def _reports() -> list[Report]:
    now = datetime.now(UTC)
    content = (
        "# E2E Market Intelligence\n\n"
        "## Executive Summary\n\n"
        "**AI stocks** led the market while policy risk remained visible.\n\n"
        "## Key Drivers\n\n"
        "- Earnings momentum\n"
        "- Macro policy signals\n\n"
        "### Watch Items\n\n"
        "Track liquidity, chip demand, and index breadth."
    )
    return [
        Report(
            report_type=ReportType.DAILY,
            title="E2E Daily Market Intelligence",
            content=content,
            market_scope=["us"],
            category_scope=["finance"],
            period_start=date.today(),
            period_end=date.today(),
            generated_at=now,
            item_count=18,
            sentiment_score=0.72,
        ),
        Report(
            report_type=ReportType.WEEKLY,
            title="E2E Weekly Market Intelligence",
            content=content,
            market_scope=["us", "cn"],
            category_scope=["finance", "macro"],
            period_start=date.today() - timedelta(days=6),
            period_end=date.today(),
            generated_at=now - timedelta(hours=1),
            item_count=36,
            sentiment_score=0.55,
        ),
        Report(
            report_type=ReportType.MONTHLY,
            title="E2E Monthly Market Intelligence",
            content=content,
            market_scope=["global"],
            category_scope=["finance"],
            period_start=date.today().replace(day=1),
            period_end=date.today(),
            generated_at=now - timedelta(hours=2),
            item_count=45,
            sentiment_score=0.62,
        ),
    ]


def _watchlists(user_ids: list[UUID], source_id: UUID) -> list[Watchlist]:
    return [
        Watchlist(
            user_id=user_id,
            name="E2E AI Watchlist",
            keywords=["AI", "stock"],
            sources=[str(source_id)],
            markets=["us"],
        )
        for user_id in user_ids
    ]


def _logs(source_id: UUID) -> list[CollectorLog]:
    now = datetime.now(UTC)
    return [
        CollectorLog(
            source_id=source_id,
            status=CollectorStatus.SUCCESS,
            items_count=12,
            duration_ms=210,
            executed_at=now,
        ),
        CollectorLog(
            source_id=source_id,
            status=CollectorStatus.FAIL,
            items_count=0,
            error_message="E2E simulated failure",
            duration_ms=90,
            executed_at=now + timedelta(seconds=2),
        ),
        CollectorLog(
            source_id=source_id,
            status=CollectorStatus.TIMEOUT,
            items_count=0,
            error_message="E2E simulated timeout",
            duration_ms=60000,
            executed_at=now + timedelta(seconds=1),
        ),
    ]


def _llm_usage() -> list[LLMUsageLog]:
    now = datetime.now(UTC)
    return [
        LLMUsageLog(
            provider="openai",
            model="gpt-4.1-mini",
            function_type=LLMFunctionType.SUMMARY,
            input_tokens=120,
            output_tokens=40,
            created_at=now,
        ),
        LLMUsageLog(
            provider="openai",
            model="gpt-4.1-mini",
            function_type=LLMFunctionType.REPORT,
            input_tokens=240,
            output_tokens=90,
            created_at=now,
        ),
    ]


async def _seed_market_indices_cache() -> None:
    now = _now_utc()
    indices: list[MarketIndex] = []
    for config in INDEX_CONFIGS:
        current = round(config.fallback_value * (1 + config.fallback_change_pct / 100), 2)
        sparkline = _market_series(config.fallback_value, current, 48, now, minutes=5)
        range_series = {
            "5D": _market_series(config.fallback_value * 0.995, current, 30, now, hours=4),
            "1M": _market_series(config.fallback_value * 0.99, current, 32, now, hours=18),
            "3M": _market_series(config.fallback_value * 0.985, current, 36, now, days=2),
            "1Y": _market_series(config.fallback_value * 0.96, current, 40, now, days=7),
        }
        indices.append(
            MarketIndex(
                symbol=config.symbol,
                name=config.name,
                value=current,
                previous_close=config.fallback_value,
                change_pct=config.fallback_change_pct,
                market=config.market,
                currency=config.currency,
                is_trading=_is_trading(config, now),
                is_fallback_data=False,
                trading_hours=TradingHours(
                    open=config.open_time.strftime("%H:%M"),
                    close=config.close_time.strftime("%H:%M"),
                    timezone=config.timezone,
                    sessions=[
                        TradingSession(
                            open=session_open.strftime("%H:%M"),
                            close=session_close.strftime("%H:%M"),
                        )
                        for session_open, session_close in config.sessions
                    ],
                    beijing_sessions=_sessions_to_beijing(config),
                ),
                sparkline_24h=[point[1] for point in sparkline],
                sparkline_times=[point[0].isoformat() for point in sparkline],
                sparkline_ranges={
                    key: MarketSparkline(
                        values=[point[1] for point in points],
                        times=[point[0].isoformat() for point in points],
                    )
                    for key, points in range_series.items()
                },
            )
        )
    client = create_redis_client()
    try:
        await client.set(
            CACHE_KEY,
            MarketIndicesResponse(
                indices=indices, updated_at=now + timedelta(minutes=30)
            ).model_dump_json(),
            ex=3600,
        )
    finally:
        await client.aclose()


async def _clear_e2e_caches() -> None:
    client = create_redis_client()
    try:
        keys: list[str] = []
        async for key in client.scan_iter(match="sigma:items:*"):
            keys.append(key.decode() if isinstance(key, bytes) else str(key))
        if keys:
            await client.delete(*keys)
    finally:
        await client.aclose()


def _market_series(
    start: float,
    end: float,
    count: int,
    now: datetime,
    *,
    minutes: int = 0,
    hours: int = 0,
    days: int = 0,
) -> list[tuple[datetime, float]]:
    step = timedelta(minutes=minutes, hours=hours, days=days)
    if step.total_seconds() <= 0:
        step = timedelta(minutes=1)
    points: list[tuple[datetime, float]] = []
    for index in range(count):
        progress = index / max(count - 1, 1)
        wave = (0.5 - abs(progress - 0.5)) * end * 0.002
        value = round(start + (end - start) * progress + wave, 2)
        points.append((now - step * (count - index - 1), value))
    return points


async def _upsert_config(db, key: str, value: object) -> None:
    config = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    if config is None:
        db.add(SystemConfig(key=key, value={"value": value}))
        return
    config.value = {"value": value}


if __name__ == "__main__":
    asyncio.run(main())
