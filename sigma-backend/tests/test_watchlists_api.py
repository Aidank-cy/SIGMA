from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes.watchlists import get_watchlist_stats, get_watchlist_trend
from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType
from app.models.user import User
from app.models.watchlist import Watchlist


def test_watchlist_crud_and_items(client: TestClient) -> None:
    """Users can manage watchlists and read their filtered feed."""
    token = _token(client, "watchlist-user@example.com")
    headers = _auth(token)

    create_response = client.post(
        "/api/v1/watchlists",
        headers=headers,
        json={"name": "US macro", "keywords": ["rates"], "sources": [], "markets": ["us"]},
    )
    assert create_response.status_code == 201
    watchlist = create_response.json()

    list_response = client.get("/api/v1/watchlists", headers=headers)
    items_response = client.get(f"/api/v1/watchlists/{watchlist['id']}/items", headers=headers)
    update_response = client.put(
        f"/api/v1/watchlists/{watchlist['id']}",
        headers=headers,
        json={"name": "Global macro", "keywords": ["inflation"], "sources": [], "markets": ["global"]},
    )
    delete_response = client.delete(f"/api/v1/watchlists/{watchlist['id']}", headers=headers)

    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["name"] == "US macro"
    assert list_response.json()["items"][0]["item_count"] == 0
    assert items_response.status_code == 200
    assert items_response.json()["total"] == 0
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Global macro"
    assert delete_response.status_code == 204


@pytest.mark.asyncio
async def test_watchlist_stats_and_trend(db_session: AsyncSession) -> None:
    """Watchlist stats expose 24h matches, sentiment, and seven-day counts."""
    user = User(
        id=uuid4(),
        email="watchlist-stats@example.com",
        hashed_password="hashed",
        display_name="Watchlist Stats",
    )
    source = _source()
    watchlist = Watchlist(
        id=uuid4(),
        user_id=user.id,
        name="Chips",
        keywords=["chip"],
        markets=["us"],
        sources=[],
    )
    db_session.add_all([user, source, watchlist])
    db_session.add_all(
        [
            _item(source, "Chip rally", "Strong chip growth", datetime.now(timezone.utc)),
            _item(
                source,
                "Chip risk",
                "Bearish chip risk",
                datetime.now(timezone.utc) - timedelta(days=2),
            ),
            _item(source, "Oil rally", "Strong energy growth", datetime.now(timezone.utc)),
        ]
    )
    await db_session.commit()

    stats = await get_watchlist_stats(watchlist.id, user, db_session)
    trend = await get_watchlist_trend(watchlist.id, user, db_session)

    assert stats.matches_today == 1
    assert stats.bullish_pct == 50
    assert len(trend.days) == 7
    assert sum(day.count for day in trend.days) == 2


def _token(client: TestClient, email: str) -> str:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPass1", "display_name": "SIGMA User"},
    )
    assert register_response.status_code == 201
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPass1"},
    )
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _source() -> DataSource:
    return DataSource(
        id=uuid4(),
        name=f"watchlist-source-{uuid4()}",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://rss.test/feed.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
    )


def _item(source: DataSource, title: str, summary: str, collected_at: datetime) -> CollectedItem:
    return CollectedItem(
        source_id=source.id,
        title=title,
        content_raw=f"{title} content",
        content_url=f"https://watchlist.test/{uuid4()}",
        summary=summary,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=collected_at,
        collected_at=collected_at,
        expires_at=collected_at + timedelta(days=30),
    )
