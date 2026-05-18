"""Seed SIGMA with deterministic demo content for local product testing.

Run from the backend directory:
    python3 scripts/seed_demo_data.py

Clear and reseed demo records:
    python3 scripts/seed_demo_data.py --clear
"""

from __future__ import annotations

# ruff: noqa: E402

import argparse
import asyncio
import random
import re
import sys
from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Literal

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.collectors.seeds import SEED_SOURCES
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
    UserLocale,
    UserRole,
)
from app.models.llm_usage_log import LLMUsageLog
from app.models.report import Report
from app.models.system_config import SystemConfig
from app.models.user import User
from app.models.user_report_config import UserReportConfig
from app.models.watchlist import Watchlist
from app.services.auth_service import hash_password

CHECK = "\u2713"
DEMO_PROVIDER = "anthropic"
DEMO_MODEL = "claude-sonnet-4-20250514"
DEMO_USER_EMAILS = [
    "admin@sigma.demo",
    "alice@sigma.demo",
    "bob@sigma.demo",
    "carol@sigma.demo",
]
DEMO_WATCHLIST_NAMES = [
    "US Tech Stocks",
    "China Policy Watch",
    "Global Macro",
    "\u65e5\u672c\u5e02\u573a",
]
SYSTEM_CONFIGS = {
    "sigma.llm.provider": DEMO_PROVIDER,
    "sigma.llm.model": DEMO_MODEL,
    "sigma.scheduler.cleanup_cron": "0 3 * * *",
}


ContentLength = Literal["short", "medium", "long"]
ItemSpec = tuple[IntelligenceCategory, Market, str, list[str], str, ContentLength]

FINANCE = IntelligenceCategory.FINANCE
POLITICS = IntelligenceCategory.POLITICS
TECHNOLOGY = IntelligenceCategory.TECHNOLOGY
MACRO = IntelligenceCategory.MACRO
US = Market.US
CN = Market.CN
JP = Market.JP
EU = Market.EU
HK = Market.HK
GLOBAL = Market.GLOBAL


ITEM_SPECS: list[ItemSpec] = [
    (FINANCE, US, "Fed holds rates steady at 5.25%", ["Fed", "rates", "CPI"], "neutral", "short"),
    (FINANCE, US, "S&P 500 hits new record amid AI rally", ["S&P 500", "AI"], "bullish", "medium"),
    (FINANCE, US, "Tesla Q2 earnings beat expectations", ["Tesla", "earnings"], "bullish", "long"),
    (FINANCE, US, "NVIDIA adds $180 billion in market value after guidance raise", ["NVIDIA", "AI"], "bullish", "short"),
    (FINANCE, US, "Apple services revenue offsets softer iPhone demand", ["Apple", "services"], "neutral", "medium"),
    (FINANCE, US, "US banks lift loan-loss reserves as consumers slow spending", ["banks", "credit"], "bearish", "long"),
    (FINANCE, US, "Treasury yields retreat as traders price September rate cut", ["Treasury", "rates"], "bullish", "short"),
    (FINANCE, US, "Semiconductor shares extend gains on cloud capex outlook", ["semiconductors", "cloud"], "bullish", "medium"),
    (FINANCE, US, "Retail stocks fall after mixed same-store sales data", ["retail", "sales"], "bearish", "long"),
    (FINANCE, US, "Small caps rebound as funding conditions improve", ["small caps", "funding"], "bullish", "short"),
    (FINANCE, US, "Oil majors rise with Brent crude near three-month high", ["oil", "Brent"], "bullish", "medium"),
    (FINANCE, US, "Dollar slips as investors rotate into risk assets", ["dollar", "risk"], "neutral", "long"),
    (FINANCE, US, "Cloud software sector rallies after resilient bookings", ["software", "bookings"], "bullish", "short"),
    (FINANCE, US, "Biotech IPO window reopens with two oversubscribed listings", ["biotech", "IPO"], "bullish", "medium"),
    (FINANCE, US, "Private credit funds report slower but positive inflows", ["private credit"], "neutral", "long"),
    (FINANCE, CN, "PBOC cuts reserve ratio by 25bps", ["PBOC", "RRR"], "bullish", "short"),
    (FINANCE, CN, "A-share market rebounds on stimulus hopes", ["A-share", "stimulus"], "bullish", "medium"),
    (FINANCE, CN, "China property developers gain after funding support plan", ["property", "funding"], "bullish", "long"),
    (FINANCE, CN, "Mainland brokerages rise as margin financing stabilizes", ["brokerages"], "bullish", "short"),
    (FINANCE, CN, "Consumer names lag after weaker holiday travel spending", ["consumer", "travel"], "bearish", "medium"),
    (FINANCE, CN, "Yuan strengthens on state bank dollar selling reports", ["yuan", "dollar"], "neutral", "long"),
    (FINANCE, CN, "EV supply chain shares advance on export order growth", ["EV", "exports"], "bullish", "short"),
    (FINANCE, CN, "Industrial profits rise for third straight month", ["industrial profits"], "bullish", "medium"),
    (FINANCE, CN, "Shanghai Composite closes higher on liquidity support", ["Shanghai Composite"], "bullish", "long"),
    (FINANCE, CN, "China insurers increase allocation to dividend stocks", ["insurers", "dividends"], "neutral", "short"),
    (FINANCE, JP, "Nikkei 225 crosses 40,000 milestone", ["Nikkei", "日経"], "bullish", "short"),
    (FINANCE, JP, "BOJ signals end to negative rates", ["BOJ", "rates"], "neutral", "medium"),
    (FINANCE, JP, "Yen volatility rises ahead of wage negotiation results", ["yen", "円"], "bearish", "long"),
    (FINANCE, JP, "Japan exporters climb as auto orders recover", ["Japan", "autos"], "bullish", "short"),
    (FINANCE, JP, "Tokyo inflation cools but remains above BOJ target", ["inflation", "BOJ"], "neutral", "medium"),
    (FINANCE, JP, "Japanese banks gain on steeper yield curve", ["banks", "yield curve"], "bullish", "long"),
    (FINANCE, JP, "Robot makers rally after factory automation orders improve", ["robots", "automation"], "bullish", "short"),
    (FINANCE, JP, "Japan REITs slip as long-end yields edge higher", ["REITs", "yields"], "bearish", "medium"),
    (FINANCE, JP, "TOPIX value shares outperform growth peers", ["TOPIX", "value"], "neutral", "long"),
    (FINANCE, JP, "Household spending data points to gradual recovery", ["spending", "GDP"], "neutral", "short"),
    (FINANCE, EU, "ECB holds rates, signals cut in June", ["ECB", "rates"], "bullish", "short"),
    (FINANCE, EU, "European luxury shares stabilize after China demand update", ["luxury", "China"], "neutral", "medium"),
    (FINANCE, EU, "DAX closes at record as exporters benefit from softer euro", ["DAX", "euro"], "bullish", "long"),
    (FINANCE, EU, "Eurozone bank stocks rise on net interest income guidance", ["banks", "income"], "bullish", "short"),
    (FINANCE, EU, "Renewable energy developers drop after auction pricing reset", ["renewables"], "bearish", "medium"),
    (FINANCE, HK, "Hang Seng Tech Index drops 3% on regulation fears", ["Hang Seng", "regulation"], "bearish", "short"),
    (FINANCE, HK, "Hong Kong IPO pipeline improves as biotech issuer files", ["Hong Kong", "IPO"], "bullish", "medium"),
    (FINANCE, HK, "Mainland internet ADRs lift Hong Kong turnover", ["internet", "turnover"], "bullish", "long"),
    (FINANCE, HK, "Hong Kong property shares fall on refinancing concerns", ["property", "refinancing"], "bearish", "short"),
    (FINANCE, HK, "Southbound flows support high-dividend financials", ["southbound", "dividends"], "bullish", "medium"),
    (POLITICS, US, "White House announces new chip export controls", ["White House", "chips"], "bearish", "medium"),
    (POLITICS, US, "Senate committee advances bipartisan AI safety bill", ["AI", "Senate"], "neutral", "long"),
    (POLITICS, US, "Treasury outlines outbound investment screening rules", ["Treasury", "screening"], "neutral", "short"),
    (POLITICS, US, "Commerce Department expands clean-energy grant program", ["Commerce", "clean energy"], "bullish", "medium"),
    (POLITICS, US, "Congress debates debt ceiling framework before recess", ["Congress", "debt"], "neutral", "long"),
    (POLITICS, GLOBAL, "G7 agrees on coordinated sanctions package", ["G7", "sanctions"], "neutral", "short"),
    (POLITICS, GLOBAL, "EU and ASEAN ministers discuss supply-chain resilience", ["EU", "ASEAN"], "neutral", "medium"),
    (POLITICS, GLOBAL, "Global trade talks focus on critical minerals access", ["trade", "minerals"], "bullish", "long"),
    (POLITICS, GLOBAL, "Oil producers extend voluntary output curbs", ["oil", "OPEC"], "bullish", "short"),
    (POLITICS, GLOBAL, "IMF urges fiscal discipline as election cycle intensifies", ["IMF", "fiscal"], "neutral", "medium"),
    (TECHNOLOGY, GLOBAL, "NVIDIA unveils next-gen AI chips at GTC", ["NVIDIA", "GTC"], "bullish", "long"),
    (TECHNOLOGY, GLOBAL, "OpenAI announces GPT-5 release date", ["OpenAI", "GPT-5"], "bullish", "short"),
    (TECHNOLOGY, GLOBAL, "Cloud providers raise capital spending forecasts for AI clusters", ["cloud", "AI"], "bullish", "medium"),
    (TECHNOLOGY, GLOBAL, "Cybersecurity vendors report surge in identity attacks", ["cybersecurity"], "bearish", "long"),
    (TECHNOLOGY, GLOBAL, "Chip equipment makers see orders recover from memory customers", ["chips", "memory"], "bullish", "short"),
    (MACRO, US, "US CPI falls to 2.8%, lowest since 2021", ["CPI", "inflation"], "bullish", "long"),
    (MACRO, US, "Unemployment holds steady at 3.7%", ["unemployment", "labor"], "neutral", "short"),
    (MACRO, US, "US GDP growth revised higher on services spending", ["GDP", "services"], "bullish", "medium"),
    (MACRO, US, "Consumer confidence improves as inflation expectations ease", ["confidence", "inflation"], "bullish", "long"),
    (MACRO, US, "Manufacturing PMI returns to expansion for first time in months", ["PMI", "manufacturing"], "bullish", "short"),
]


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed SIGMA demo data for manual testing.")
    parser.add_argument("--clear", action="store_true", help="Delete demo records before seeding.")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        if args.clear:
            await clear_demo_data(db)
        await seed_demo_data(db)
    await engine.dispose()


async def clear_demo_data(db: AsyncSession) -> None:
    print("Clearing demo data...", end=" ")
    demo_users = list(await db.scalars(select(User).where(User.email.in_(DEMO_USER_EMAILS))))
    demo_user_ids = [user.id for user in demo_users]
    source_ids = list(await db.scalars(select(DataSource.id).where(DataSource.name.in_(source_names()))))

    if source_ids:
        await db.execute(delete(CollectorLog).where(CollectorLog.source_id.in_(source_ids)))
    await db.execute(delete(CollectedItem).where(CollectedItem.title.in_(item_titles())))
    await db.execute(
        delete(Report).where(
            or_(
                Report.title.like("SIGMA Daily Intelligence%"),
                Report.title.like("SIGMA Weekly Intelligence%"),
                Report.title.like("SIGMA Monthly Intelligence%"),
            )
        )
    )
    if demo_user_ids:
        await db.execute(delete(Watchlist).where(Watchlist.user_id.in_(demo_user_ids)))
        await db.execute(delete(UserReportConfig).where(UserReportConfig.user_id.in_(demo_user_ids)))
        await db.execute(
            update(DataSource).where(DataSource.created_by.in_(demo_user_ids)).values(created_by=None)
        )
    await db.execute(delete(SystemConfig).where(SystemConfig.key.in_(list(SYSTEM_CONFIGS))))
    await db.execute(
        delete(LLMUsageLog).where(
            LLMUsageLog.provider == DEMO_PROVIDER,
            LLMUsageLog.model == DEMO_MODEL,
        )
    )
    if demo_user_ids:
        await db.execute(delete(User).where(User.id.in_(demo_user_ids)))
    await db.commit()
    print(f"{CHECK}")


async def seed_demo_data(db: AsyncSession) -> None:
    users = await create_users(db)
    sources = await ensure_data_sources(db)
    await create_items(db, sources)
    await create_watchlists(db, users)
    await create_reports(db)
    await create_report_configs(db, users)
    await create_collector_logs(db, sources)
    await create_system_configs(db)
    await create_llm_usage_logs(db)


async def create_users(db: AsyncSession) -> dict[str, User]:
    print("Creating users...", end=" ")
    specs = [
        ("admin@sigma.demo", "Admin123!", "Admin", UserRole.ADMIN, UserLocale.ZH),
        ("alice@sigma.demo", "User1234!", "Alice Chen", UserRole.USER, UserLocale.EN),
        ("bob@sigma.demo", "User1234!", "Bob Wang", UserRole.USER, UserLocale.ZH),
        ("carol@sigma.demo", "User1234!", "Carol Li", UserRole.USER, UserLocale.EN),
    ]
    created = 0
    users: dict[str, User] = {}
    for email, password, display_name, role, locale in specs:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                display_name=display_name,
                role=role,
                locale=locale,
                data_retention_days=30,
                is_active=True,
            )
            db.add(user)
            await db.flush()
            created += 1
        users[email] = user
    await db.commit()
    print(f"{CHECK} ({created} new, {len(users)} total)")
    return users


async def ensure_data_sources(db: AsyncSession) -> list[DataSource]:
    print("Ensuring data sources...", end=" ")
    existing_names = set(await db.scalars(select(DataSource.name)))
    created = 0
    for payload in SEED_SOURCES:
        if str(payload["name"]) in existing_names:
            continue
        db.add(DataSource(**payload))
        created += 1
    if created:
        await db.commit()
    sources = list(await db.scalars(select(DataSource).order_by(DataSource.name)))
    print(f"{CHECK} ({created} new, {len(sources)} available)")
    return sources


async def create_items(db: AsyncSession, sources: Sequence[DataSource]) -> None:
    print("Creating items...", end=" ")
    now = datetime.now(UTC)
    rng = random.Random(20260517)
    created = 0
    for index, spec in enumerate(ITEM_SPECS):
        category, market, title, keywords, sentiment, content_length = spec
        existing = await db.scalar(select(CollectedItem.id).where(CollectedItem.title == title))
        if existing is not None:
            continue
        published_at = now - timedelta(
            days=index % 14,
            hours=rng.randint(0, 22),
            minutes=rng.randint(0, 59),
        )
        collected_at = published_at + timedelta(minutes=rng.randint(10, 60))
        item = CollectedItem(
            source_id=select_source(sources, category, market).id,
            title=title,
            content_raw=article_body(title, category, market, keywords, content_length),
            content_url=demo_url(category, market, title),
            summary=summary_for(title, market, sentiment, content_length),
            category=category,
            market=market,
            published_at=published_at,
            collected_at=collected_at,
            expires_at=collected_at + timedelta(days=30),
            metadata_extra={
                "demo_seed": True,
                "content_length": content_length,
                "sentiment": sentiment,
                "keywords": keywords,
            },
        )
        db.add(item)
        created += 1
    await db.commit()
    print(f"{CHECK} ({created} new, {len(ITEM_SPECS)} total specs)")


async def create_watchlists(db: AsyncSession, users: dict[str, User]) -> None:
    print("Creating watchlists...", end=" ")
    specs = [
        (users["admin@sigma.demo"], "US Tech Stocks", ["NVIDIA", "Apple", "Tesla", "AI"], ["us"]),
        (
            users["admin@sigma.demo"],
            "China Policy Watch",
            ["PBOC", "stimulus", "regulation"],
            ["cn", "hk"],
        ),
        (
            users["alice@sigma.demo"],
            "Global Macro",
            ["CPI", "inflation", "rates", "GDP"],
            [market.value for market in Market],
        ),
        (users["bob@sigma.demo"], "\u65e5\u672c\u5e02\u573a", ["\u65e5\u7d4c", "BOJ", "\u5186"], ["jp"]),
    ]
    created = 0
    for user, name, keywords, markets in specs:
        existing = await db.scalar(
            select(Watchlist.id).where(Watchlist.user_id == user.id, Watchlist.name == name)
        )
        if existing is not None:
            continue
        db.add(Watchlist(user_id=user.id, name=name, keywords=keywords, sources=[], markets=markets))
        created += 1
    await db.commit()
    print(f"{CHECK} ({created} new, 4 total specs)")


async def create_reports(db: AsyncSession) -> None:
    print("Creating reports...", end=" ")
    today = date.today()
    yesterday = today - timedelta(days=1)
    week_start, week_end = last_week(today)
    month_start, month_end = last_month(today)
    specs = [
        (
            ReportType.DAILY,
            f"SIGMA Daily Intelligence - {yesterday.isoformat()}",
            market_report("daily", 500),
            ["us", "cn", "jp"],
            ["finance", "politics", "macro"],
            yesterday,
            yesterday,
            24,
            0.62,
        ),
        (
            ReportType.WEEKLY,
            f"SIGMA Weekly Intelligence - {week_start.isoformat()} to {week_end.isoformat()}",
            market_report("weekly", 800),
            ["us", "cn", "jp", "eu", "hk"],
            ["finance", "politics", "technology", "macro"],
            week_start,
            week_end,
            52,
            0.58,
        ),
        (
            ReportType.MONTHLY,
            f"SIGMA Monthly Intelligence - {month_start.strftime('%Y-%m')}",
            market_report("monthly", 1000),
            [market.value for market in Market],
            [category.value for category in IntelligenceCategory],
            month_start,
            month_end,
            len(ITEM_SPECS),
            0.55,
        ),
    ]
    created = 0
    for report_type, title, content, markets, categories, start, end, item_count, sentiment in specs:
        existing = await db.scalar(select(Report.id).where(Report.title == title))
        if existing is not None:
            continue
        db.add(
            Report(
                report_type=report_type,
                title=title,
                content=content,
                market_scope=markets,
                category_scope=categories,
                period_start=start,
                period_end=end,
                generated_at=datetime.combine(end, time(hour=17), UTC),
                item_count=item_count,
                sentiment_score=sentiment,
            )
        )
        created += 1
    await db.commit()
    print(f"{CHECK} ({created} new, 3 total specs)")


async def create_report_configs(db: AsyncSession, users: dict[str, User]) -> None:
    print("Creating report configs...", end=" ")
    all_markets = [market.value for market in Market]
    all_categories = [category.value for category in IntelligenceCategory]
    specs = [
        (users["admin@sigma.demo"], ReportType.DAILY, all_markets, all_categories),
        (users["alice@sigma.demo"], ReportType.WEEKLY, ["us", "eu"], ["finance", "macro"]),
        (users["bob@sigma.demo"], ReportType.DAILY, ["jp", "cn"], ["finance"]),
        (users["carol@sigma.demo"], ReportType.MONTHLY, all_markets, all_categories),
    ]
    upserts = 0
    for user, frequency, markets, categories in specs:
        config = await db.scalar(select(UserReportConfig).where(UserReportConfig.user_id == user.id))
        if config is None:
            db.add(
                UserReportConfig(
                    user_id=user.id,
                    report_frequency=frequency,
                    markets=markets,
                    categories=categories,
                    is_active=True,
                )
            )
        else:
            config.report_frequency = frequency
            config.markets = markets
            config.categories = categories
            config.is_active = True
        upserts += 1
    await db.commit()
    print(f"{CHECK} ({upserts} configured)")


async def create_collector_logs(db: AsyncSession, sources: Sequence[DataSource]) -> None:
    print("Creating collector logs...", end=" ")
    since = datetime.now(UTC) - timedelta(days=30)
    source_ids = [source.id for source in sources]
    existing = await db.scalar(
        select(func.count())
        .select_from(CollectorLog)
        .where(CollectorLog.source_id.in_(source_ids), CollectorLog.executed_at >= since)
    )
    if (existing or 0) >= 30:
        print(f"{CHECK} (0 new, existing logs kept)")
        return

    rng = random.Random(2401)
    statuses = [CollectorStatus.SUCCESS] * 25 + [CollectorStatus.FAIL] * 3 + [CollectorStatus.TIMEOUT] * 2
    error_messages = [
        "HTTPError: 429 Too Many Requests",
        "ConnectionTimeout: target host unreachable",
        "HTTPError: 503 Service Unavailable",
    ]
    now = datetime.now(UTC)
    created = 0
    for index, status in enumerate(statuses):
        source = sources[index % len(sources)]
        error_message = None
        if status == CollectorStatus.FAIL:
            error_message = error_messages[index % len(error_messages)]
        if status == CollectorStatus.TIMEOUT:
            error_message = "ConnectionTimeout: target host unreachable"
        duration_ms = {
            CollectorStatus.SUCCESS: rng.randint(1000, 5000),
            CollectorStatus.FAIL: rng.randint(500, 2000),
            CollectorStatus.TIMEOUT: 300_000,
        }[status]
        db.add(
            CollectorLog(
                source_id=source.id,
                status=status,
                items_count=rng.randint(3, 16) if status == CollectorStatus.SUCCESS else 0,
                error_message=error_message,
                duration_ms=duration_ms,
                executed_at=now - timedelta(days=index % 7, hours=rng.randint(0, 23)),
            )
        )
        created += 1
    await db.commit()
    print(f"{CHECK} ({created} new)")


async def create_system_configs(db: AsyncSession) -> None:
    print("Creating system config...", end=" ")
    upserts = 0
    for key, value in SYSTEM_CONFIGS.items():
        config = await db.scalar(select(SystemConfig).where(SystemConfig.key == key))
        if config is None:
            db.add(SystemConfig(key=key, value={"value": value}))
        else:
            config.value = {"value": value}
        upserts += 1
    await db.commit()
    print(f"{CHECK} ({upserts} configured)")


async def create_llm_usage_logs(db: AsyncSession) -> None:
    print("Creating LLM usage logs...", end=" ")
    since = datetime.now(UTC) - timedelta(days=30)
    existing = await db.scalar(
        select(func.count())
        .select_from(LLMUsageLog)
        .where(
            LLMUsageLog.provider == DEMO_PROVIDER,
            LLMUsageLog.model == DEMO_MODEL,
            LLMUsageLog.created_at >= since,
        )
    )
    if (existing or 0) >= 20:
        print(f"{CHECK} (0 new, existing logs kept)")
        return

    rng = random.Random(4501)
    function_types = [LLMFunctionType.SUMMARY] * 15 + [LLMFunctionType.REPORT] * 5
    now = datetime.now(UTC)
    for index, function_type in enumerate(function_types):
        db.add(
            LLMUsageLog(
                provider=DEMO_PROVIDER,
                model=DEMO_MODEL,
                function_type=function_type,
                input_tokens=rng.randint(500, 3000),
                output_tokens=rng.randint(100, 800),
                created_at=now - timedelta(days=index % 7, hours=rng.randint(0, 23)),
            )
        )
    await db.commit()
    print(f"{CHECK} (20 new)")


def select_source(
    sources: Sequence[DataSource],
    category: IntelligenceCategory,
    market: Market,
) -> DataSource:
    for source in sources:
        if source.category == category and source.market == market:
            return source
    for source in sources:
        if source.category == category and source.market == GLOBAL:
            return source
    for source in sources:
        if source.category == category:
            return source
    return sources[0]


def article_body(
    title: str,
    category: IntelligenceCategory,
    market: Market,
    keywords: Sequence[str],
    content_length: ContentLength,
) -> str:
    if content_length == "short":
        return short_article_body(title, category, market, keywords)
    if content_length == "long":
        return long_article_body(title, category, market, keywords)
    return medium_article_body(title, category, market, keywords)


def short_article_body(
    title: str,
    category: IntelligenceCategory,
    market: Market,
    keywords: Sequence[str],
) -> str:
    region = market.value.upper()
    topic = ", ".join(keywords[:2])
    return (
        f"{title}. The {region} {category.value} signal moved quickly as desks focused on "
        f"{topic}. SIGMA is tracking whether the headline produces follow-through in rates, "
        "currencies, and the most exposed equity sectors. For demo review, this item is meant "
        "to read like a fast market flash rather than a full analyst note."
    )


def medium_article_body(
    title: str,
    category: IntelligenceCategory,
    market: Market,
    keywords: Sequence[str],
) -> str:
    region = market.value.upper()
    topic = ", ".join(keywords[:3])
    return (
        f"{title}. Market participants described the move as an important signal for the "
        f"{region} {category.value} narrative, with desks flagging {topic} as the main "
        "drivers of positioning through the session. Volumes were above recent averages "
        "and cross-asset reactions were most visible in rates, currencies, and large-cap "
        "equities.\n\n"
        "Analysts said the next phase depends on confirmation from incoming data and policy "
        "communication. Portfolio managers are keeping gross exposure measured while adding "
        "selective risk in names with strong balance sheets, pricing power, and clear earnings "
        "visibility.\n\n"
        "The move also changes the watchlist priority for related sectors. Follow-up signals "
        "from policy desks, broker revisions, and currency markets will help determine whether "
        "this is a short-lived reaction or the start of a broader allocation shift.\n\n"
        "The immediate implication for SIGMA monitoring is a higher priority on related source "
        "updates, follow-through in futures markets, and whether the story broadens beyond the "
        "initial headline into sector-level revisions."
    )


def long_article_body(
    title: str,
    category: IntelligenceCategory,
    market: Market,
    keywords: Sequence[str],
) -> str:
    region = market.value.upper()
    topic = ", ".join(keywords[:3])
    return (
        f"{title}. The headline landed as a broader {region} {category.value} story rather "
        f"than a single-asset move, with traders immediately linking it to {topic}. Early "
        "price action showed stronger activity in index futures, rates, and the most liquid "
        "large-cap names, while defensive sectors moved more cautiously.\n\n"
        "The first market read was about positioning. Several desks had entered the session "
        "with lighter risk after a run of mixed macro data, so even a modest surprise created "
        "an outsized reaction in crowded trades. Volumes were concentrated near the open and "
        "again around regional policy headlines.\n\n"
        "The second read was about transmission. Analysts said the story matters most if it "
        "changes earnings estimates, funding costs, or regulatory assumptions over the next "
        "several sessions. That makes source follow-up more important than the first headline "
        "alone, especially for watchlists tied to policy, AI infrastructure, banks, property, "
        "or export demand.\n\n"
        "Cross-market signals were mixed but useful. Currency moves suggested investors were "
        "not treating the update as a pure risk-on event, while credit spreads remained stable "
        "enough to avoid a defensive rotation. Commodity-linked names reacted mainly through "
        "demand expectations rather than supply shock pricing.\n\n"
        "Sector rotation added another layer. Momentum accounts favored liquid leaders first, "
        "but the more important test is whether second-tier suppliers, regional banks, and "
        "domestic demand proxies begin to confirm the same direction. Without that breadth, "
        "the move may remain a positioning adjustment rather than a durable market regime "
        "change.\n\n"
        "Macro sensitivity also remains high. A single inflation print, central-bank speech, "
        "or funding headline could change the interpretation quickly, especially in markets "
        "where liquidity is concentrated in a narrow group of index heavyweights. That makes "
        "the timing of follow-up alerts as important as the headline classification itself.\n\n"
        "Investor time horizon is the final distinction. Fast-money accounts may only need a "
        "few sessions of confirmation, but long-only funds will look for evidence that margins, "
        "cash flow, and policy support can survive the next macro release cycle. That gap between "
        "trading reaction and fundamental confirmation is where the best monitoring value sits.\n\n"
        "The risk case is still visible. If liquidity fades, if officials walk back the policy "
        "signal, or if earnings revisions fail to appear, the market could unwind the initial "
        "move quickly. SIGMA should therefore track both positive continuation signals and early "
        "signs that the headline has already been fully priced.\n\n"
        "For SIGMA monitoring, the practical takeaway is to keep the story elevated until the "
        "next data point confirms or rejects the initial interpretation. The highest-value "
        "alerts should watch related policy remarks, revisions from major brokers, and whether "
        "the move broadens from headline-sensitive stocks into the wider market."
    )


def summary_for(title: str, market: Market, sentiment: str, content_length: ContentLength) -> str:
    tone = {
        "bullish": "constructive",
        "bearish": "cautious",
        "neutral": "balanced",
    }[sentiment]
    if content_length == "short":
        return f"{title} kept the {market.value.upper()} signal {tone} and merits quick monitoring."
    if content_length == "long":
        return (
            f"{title} kept the {market.value.upper()} signal {tone}. "
            "The fuller read-through depends on follow-up policy language, earnings revisions, "
            "liquidity conditions, and whether sector-level participation broadens."
        )
    return (
        f"{title} kept the {market.value.upper()} signal {tone}. "
        "SIGMA should watch policy follow-through, earnings revisions, and liquidity conditions."
    )


def market_report(cadence: str, target_words: int) -> str:
    sections = [
        (
            "Overview",
            "Risk appetite improved unevenly as investors balanced easier inflation readings "
            "against policy and geopolitical uncertainty. US technology leadership remained "
            "the clearest positive signal, while China and Hong Kong assets traded around "
            "expectations for liquidity support and regulatory clarity.",
        ),
        (
            "Politics/Macro",
            "Policy headlines were the main source of cross-market dispersion. The Federal "
            "Reserve stayed patient, the PBOC leaned toward targeted easing, and global trade "
            "discussions kept critical minerals and semiconductor controls in focus.",
        ),
        (
            "Financial Markets",
            "Equity breadth improved in the US and Japan, helped by AI capital expenditure, "
            "exporter resilience, and a more stable rates backdrop. Credit remained orderly, "
            "though banks and property-sensitive sectors continued to price slower consumer demand.",
        ),
        (
            "Technology",
            "AI infrastructure remained the dominant technology theme. Chip suppliers, cloud "
            "platforms, and cybersecurity vendors all generated actionable signals for watchlists, "
            "with capital spending guidance becoming more important than short-term revenue beats.",
        ),
        (
            "Key Events",
            "The most important events were the Fed rate hold, the PBOC reserve-ratio cut, "
            "the Nikkei milestone, new chip export controls, and stronger US macro data. "
            "Together they created a constructive but policy-sensitive market tape.",
        ),
        (
            "Outlook",
            "The next monitoring window should emphasize inflation prints, central-bank language, "
            "earnings revisions, and whether liquidity support reaches private demand. A durable "
            "risk rally needs broader participation beyond mega-cap AI beneficiaries.",
        ),
    ]
    lines = [f"# SIGMA {cadence.title()} Intelligence"]
    repeat = 1 + target_words // 500
    for heading, paragraph in sections:
        lines.append(f"\n## {heading}\n")
        lines.append(" ".join([paragraph] * repeat))
    return "\n".join(lines)


def demo_url(category: IntelligenceCategory, market: Market, title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"https://reuters.com/{category.value}/{market.value}/{slug}"


def item_titles() -> list[str]:
    return [title for _, _, title, _, _, _ in ITEM_SPECS]


def source_names() -> list[str]:
    return [str(payload["name"]) for payload in SEED_SOURCES]


def last_week(today: date) -> tuple[date, date]:
    this_week_start = today - timedelta(days=today.weekday())
    start = this_week_start - timedelta(days=7)
    return start, this_week_start - timedelta(days=1)


def last_month(today: date) -> tuple[date, date]:
    first_this_month = today.replace(day=1)
    end = first_this_month - timedelta(days=1)
    return end.replace(day=1), end


if __name__ == "__main__":
    asyncio.run(main())
