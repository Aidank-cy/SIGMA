import asyncio
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


def test_watchlist_http_contract_with_items_stats_trend_and_auth_edges(client: TestClient) -> None:
    """Watchlist HTTP endpoints cover ownership, filters, item feeds, stats, and trend."""
    token = _token(client, "watchlist-contract@example.com")
    headers = _auth(token)
    seeded = _seed_watchlist_items(client)

    empty_list = client.get("/api/v1/watchlists", headers=headers)
    assert empty_list.status_code == 200
    assert empty_list.json()["items"] == []

    simple_create = client.post(
        "/api/v1/watchlists",
        headers=headers,
        json={"name": "Simple", "keywords": [], "sources": [], "markets": []},
    )
    assert simple_create.status_code == 201
    assert simple_create.json()["id"]

    create_response = client.post(
        "/api/v1/watchlists",
        headers=headers,
        json={
            "name": "Chip Watch",
            "keywords": [" chip "],
            "sources": [seeded["source_id"]],
            "markets": ["us"],
        },
    )
    watchlist = create_response.json()
    assert create_response.status_code == 201
    assert watchlist["keywords"] == ["chip"]
    assert watchlist["sources"] == [seeded["source_id"]]
    assert watchlist["markets"] == ["us"]

    list_response = client.get("/api/v1/watchlists", headers=headers)
    assert list_response.status_code == 200
    assert {item["name"] for item in list_response.json()["items"]} == {"Simple", "Chip Watch"}
    chip_listed = next(item for item in list_response.json()["items"] if item["name"] == "Chip Watch")
    assert chip_listed["item_count"] == 2

    rename_response = client.put(
        f"/api/v1/watchlists/{watchlist['id']}",
        headers=headers,
        json={"name": "Renamed Chip Watch", "keywords": ["chip"], "sources": [seeded["source_id"]], "markets": ["us"]},
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["name"] == "Renamed Chip Watch"

    filter_update = client.put(
        f"/api/v1/watchlists/{watchlist['id']}",
        headers=headers,
        json={"name": "Filtered Chip Watch", "keywords": ["chip", "risk"], "sources": [], "markets": ["us"]},
    )
    assert filter_update.status_code == 200
    assert filter_update.json()["keywords"] == ["chip", "risk"]
    assert filter_update.json()["markets"] == ["us"]

    items_response = client.get(f"/api/v1/watchlists/{watchlist['id']}/items?page=1&page_size=5", headers=headers)
    assert items_response.status_code == 200
    items_payload = items_response.json()
    assert items_payload["total"] == 2
    assert {item["title"] for item in items_payload["items"]} == {"Chip rally", "Chip risk"}

    stats_response = client.get(f"/api/v1/watchlists/{watchlist['id']}/stats", headers=headers)
    assert stats_response.status_code == 200
    assert stats_response.json() == {"matches_today": 1, "bullish_pct": 50}

    trend_response = client.get(f"/api/v1/watchlists/{watchlist['id']}/trend", headers=headers)
    assert trend_response.status_code == 200
    assert len(trend_response.json()["days"]) == 7
    assert sum(day["count"] for day in trend_response.json()["days"]) == 2

    other_token = _token(client, "watchlist-other@example.com")
    other_update = client.put(
        f"/api/v1/watchlists/{watchlist['id']}",
        headers=_auth(other_token),
        json={"name": "Other", "keywords": [], "sources": [], "markets": []},
    )
    assert other_update.status_code == 404

    delete_response = client.delete(f"/api/v1/watchlists/{watchlist['id']}", headers=headers)
    missing_delete = client.delete(f"/api/v1/watchlists/{uuid4()}", headers=headers)
    unauthenticated_create = client.post(
        "/api/v1/watchlists",
        json={"name": "No Auth", "keywords": [], "sources": [], "markets": []},
    )
    assert delete_response.status_code == 204
    assert missing_delete.status_code == 404
    assert unauthenticated_create.status_code == 401


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


def _seed_watchlist_items(client: TestClient) -> dict[str, str]:
    return asyncio.run(_seed_watchlist_items_async(client))


async def _seed_watchlist_items_async(client: TestClient) -> dict[str, str]:
    session_factory = client.app.state.session_factory
    source = _source()
    now = datetime.now(timezone.utc)
    async with session_factory() as db:
        db.add(source)
        db.add_all(
            [
                _item(source, "Chip rally", "Strong bullish chip growth", now),
                _item(source, "Chip risk", "Bearish chip risk", now - timedelta(days=2)),
                _item(source, "Oil rally", "Strong energy growth", now),
            ]
        )
        await db.commit()
    return {"source_id": str(source.id)}


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
