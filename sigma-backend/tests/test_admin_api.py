import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.api.v1.admin import dashboard as admin_dashboard
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, IntelligenceCategory, LLMFunctionType, Market, SourceType
from app.models.llm_usage_log import LLMUsageLog


def test_admin_dashboard_endpoints(client: TestClient, monkeypatch) -> None:
    """Admin dashboard endpoints return machine-consumable payloads."""
    token = _token(client, "admin-dashboard@example.com")
    user_token = _token(client, "regular-dashboard@example.com")
    headers = _auth(token)
    source_id = asyncio.run(_seed_admin_dashboard_data(client))

    async def no_cache_get(_key: str) -> None:
        return None

    async def no_cache_set(_key: str, _value: str) -> None:
        return None

    monkeypatch.setattr(admin_dashboard, "_cache_get", no_cache_get)
    monkeypatch.setattr(admin_dashboard, "_cache_set", no_cache_set)

    stats = client.get("/api/v1/admin/dashboard/stats", headers=headers)
    stats_root = client.get("/api/v1/admin/dashboard", headers=headers)
    trend = client.get("/api/v1/admin/dashboard/collection-trend", headers=headers)
    activity = client.get("/api/v1/admin/dashboard/recent-activity", headers=headers)
    health = client.get("/api/v1/admin/dashboard/source-health", headers=headers)
    forbidden = client.get("/api/v1/admin/dashboard/stats", headers=_auth(user_token))

    assert stats.status_code == 200
    assert stats.json() == {
        "users": 2,
        "sources": 1,
        "active_sources": 1,
        "items": 1,
        "tokens_today": 15,
    }
    assert stats_root.status_code == 200
    assert stats_root.json() == stats.json()
    assert trend.status_code == 200
    assert len(trend.json()) == 7
    assert sum(point["items"] for point in trend.json()) == 1
    assert activity.status_code == 200
    assert activity.json()[0]["source_name"] == "Dashboard RSS"
    assert activity.json()[0]["status"] == "success"
    assert activity.json()[0]["items_count"] == 3
    assert health.status_code == 200
    assert health.json()[0]["source_id"] == source_id
    assert health.json()[0]["name"] == "Dashboard RSS"
    assert health.json()[0]["status"] == "green"
    assert forbidden.status_code == 403


def test_admin_user_management_guards(client: TestClient) -> None:
    """Admins can manage other users but cannot modify themselves."""
    admin_token = _token(client, "admin-users@example.com")
    _token(client, "managed-user@example.com")
    regular_token = _token(client, "plain-user@example.com")
    headers = _auth(admin_token)

    all_users_response = client.get("/api/v1/admin/users?page=1&page_size=10", headers=headers)
    list_response = client.get("/api/v1/admin/users?q=managed", headers=headers)
    user_id = list_response.json()["items"][0]["id"]
    self_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    promote_response = client.put(
        f"/api/v1/admin/users/{user_id}",
        headers=headers,
        json={"role": "admin"},
    )
    update_response = client.put(
        f"/api/v1/admin/users/{user_id}",
        headers=headers,
        json={"is_active": False},
    )
    self_response = client.put(
        f"/api/v1/admin/users/{self_id}",
        headers=headers,
        json={"is_active": False},
    )
    delete_response = client.delete(f"/api/v1/admin/users/{user_id}", headers=headers)
    forbidden_response = client.get("/api/v1/admin/users", headers=_auth(regular_token))

    assert all_users_response.status_code == 200
    assert all_users_response.json()["page"] == 1
    assert all_users_response.json()["page_size"] == 10
    assert all_users_response.json()["total"] == 3
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert promote_response.status_code == 200
    assert promote_response.json()["role"] == "admin"
    assert update_response.status_code == 200
    assert update_response.json()["is_active"] is False
    assert self_response.status_code == 403
    assert delete_response.status_code == 204
    assert forbidden_response.status_code == 403


def test_admin_source_preview_crud_stats_and_guards(client: TestClient, monkeypatch) -> None:
    """Admins can manage system sources, inspect logs/stats, and cascade delete source data."""
    token = _token(client, "admin-sources@example.com")
    user_token = _token(client, "regular-sources@example.com")
    headers = _auth(token)

    class FakeCollector:
        async def collect(self) -> list[dict[str, object]]:
            return [{"title": "Preview", "content": "Text"}]

        async def validate_config(self) -> bool:
            return True

    monkeypatch.setattr("app.api.v1.admin.sources.create_collector", lambda _source: FakeCollector())
    payload = _source_payload("Admin RSS")
    initial_list_response = client.get("/api/v1/admin/sources", headers=headers)
    preview_response = client.post("/api/v1/admin/sources/test", headers=headers, json=payload)
    create_response = client.post("/api/v1/admin/sources", headers=headers, json=payload)
    source_id = create_response.json()["id"]
    list_response = client.get("/api/v1/admin/sources", headers=headers)
    update_response = client.put(
        f"/api/v1/admin/sources/{source_id}",
        headers=headers,
        json={"name": "Admin RSS Updated", "is_active": False},
    )
    asyncio.run(_seed_source_artifacts(client, source_id))
    logs_response = client.get(f"/api/v1/admin/sources/{source_id}/logs", headers=headers)
    stats_response = client.get("/api/v1/admin/sources/stats", headers=headers)
    forbidden_response = client.get("/api/v1/admin/sources", headers=_auth(user_token))
    delete_response = client.delete(f"/api/v1/admin/sources/{source_id}", headers=headers)
    artifacts_remaining = asyncio.run(_source_artifact_count(client, source_id))

    assert initial_list_response.status_code == 200
    assert initial_list_response.json()["items"] == []
    assert preview_response.status_code == 200
    assert preview_response.json()["items"][0]["title"] == "Preview"
    assert create_response.status_code == 201
    assert create_response.json()["is_system"] is True
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["id"] == source_id
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Admin RSS Updated"
    assert update_response.json()["is_active"] is False
    assert logs_response.status_code == 200
    assert logs_response.json()["items"][0]["source_name"] == "Admin RSS Updated"
    assert logs_response.json()["items"][0]["status"] == "success"
    assert stats_response.status_code == 200
    assert stats_response.json() == {"total": 1, "active": 0, "system": 1}
    assert forbidden_response.status_code == 403
    assert delete_response.status_code == 204
    assert artifacts_remaining == 0


def test_admin_logs_endpoint(client: TestClient) -> None:
    """Admin logs endpoint returns pagination metadata and success rate."""
    token = _token(client, "admin-logs@example.com")

    response = client.get("/api/v1/admin/logs", headers=_auth(token))

    assert response.status_code == 200
    assert response.json()["page"] == 1
    assert response.json()["page_size"] == 50
    assert response.json()["success_rate"] == 0.0


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


def _source_payload(name: str) -> dict[str, object]:
    return {
        "name": name,
        "source_type": "rss",
        "category": "finance",
        "market": "us",
        "config": {"feed_url": "https://rss.test/feed.xml"},
        "schedule_cron": "*/5 * * * *",
        "max_execution_seconds": 60,
        "is_active": True,
    }


async def _seed_admin_dashboard_data(client: TestClient) -> str:
    session_factory = client.app.state.session_factory
    source = DataSource(
        id=uuid4(),
        name="Dashboard RSS",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://rss.test/feed.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
        is_active=True,
    )
    now = datetime.now(timezone.utc)
    async with session_factory() as db:
        db.add(source)
        db.add_all(
            [
                CollectedItem(
                    source_id=source.id,
                    title="Dashboard item",
                    content_raw="Dashboard content",
                    content_url=f"https://admin-dashboard.test/{uuid4()}",
                    summary="Dashboard summary",
                    category=IntelligenceCategory.FINANCE,
                    market=Market.US,
                    published_at=now,
                    collected_at=now,
                    expires_at=now + timedelta(days=30),
                ),
                CollectorLog(
                    source_id=source.id,
                    status=CollectorStatus.SUCCESS,
                    items_count=3,
                    error_message=None,
                    duration_ms=200,
                    executed_at=now,
                ),
                LLMUsageLog(
                    provider="openai",
                    model="gpt-test",
                    function_type=LLMFunctionType.SUMMARY,
                    input_tokens=10,
                    output_tokens=5,
                    created_at=now,
                ),
            ]
        )
        await db.commit()
    return str(source.id)


async def _seed_source_artifacts(client: TestClient, source_id: str) -> None:
    session_factory = client.app.state.session_factory
    now = datetime.now(timezone.utc)
    async with session_factory() as db:
        db.add_all(
            [
                CollectedItem(
                    source_id=UUID(source_id),
                    title="Admin source item",
                    content_raw="Admin source content",
                    content_url=f"https://admin-source.test/{uuid4()}",
                    summary="Admin source summary",
                    category=IntelligenceCategory.FINANCE,
                    market=Market.US,
                    published_at=now,
                    collected_at=now,
                    expires_at=now + timedelta(days=30),
                ),
                CollectorLog(
                    source_id=UUID(source_id),
                    status=CollectorStatus.SUCCESS,
                    items_count=2,
                    error_message=None,
                    duration_ms=150,
                    executed_at=now,
                ),
            ]
        )
        await db.commit()


async def _source_artifact_count(client: TestClient, source_id: str) -> int:
    session_factory = client.app.state.session_factory
    async with session_factory() as db:
        item_count = await db.scalar(
            select(func.count()).select_from(CollectedItem).where(CollectedItem.source_id == UUID(source_id))
        )
        log_count = await db.scalar(
            select(func.count()).select_from(CollectorLog).where(CollectorLog.source_id == UUID(source_id))
        )
    return int(item_count or 0) + int(log_count or 0)
