import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

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


def test_admin_sources_endpoints_removed(client: TestClient) -> None:
    """Admin source management endpoints are no longer registered."""
    token = _token(client, "admin-sources@example.com")
    user_token = _token(client, "regular-sources@example.com")
    headers = _auth(token)
    source_id = uuid4()

    assert client.get("/api/v1/admin/sources", headers=headers).status_code == 404
    assert client.post("/api/v1/admin/sources/test", headers=headers, json={}).status_code == 404
    assert client.put(f"/api/v1/admin/sources/{source_id}", headers=headers, json={}).status_code == 404
    assert client.get(f"/api/v1/admin/sources/{source_id}/logs", headers=headers).status_code == 404
    assert client.get("/api/v1/admin/sources/stats", headers=headers).status_code == 404
    assert client.get("/api/v1/admin/sources", headers=_auth(user_token)).status_code == 404


def test_admin_llm_config_usage_and_guards(client: TestClient) -> None:
    """Admins can manage global LLM config, inspect usage, and reject non-admins."""
    admin_token = _token(client, "admin-llm-suite@example.com")
    user_token = _token(client, "regular-llm-suite@example.com")
    headers = _auth(admin_token)
    asyncio.run(_seed_admin_llm_usage(client))

    get_response = client.get("/api/v1/admin/llm/config", headers=headers)
    update_response = client.put(
        "/api/v1/admin/llm/config",
        headers=headers,
        json={
            "provider": "gemini",
            "model": "gemini-test",
            "daily_token_limit": 6543,
            "cost_guard_enabled": False,
            "api_keys": [
                {
                    "name": "Global Gemini",
                    "key": "sk-admin-gemini",
                    "provider": "gemini",
                    "token_limit": 6543,
                    "is_default": True,
                }
            ],
        },
    )
    usage_response = client.get("/api/v1/admin/llm/usage", headers=headers)
    forbidden_response = client.get("/api/v1/admin/llm/config", headers=_auth(user_token))

    assert get_response.status_code == 200
    assert {"provider", "model", "daily_token_limit", "cost_guard_enabled", "api_keys"}.issubset(
        get_response.json()
    )
    assert update_response.status_code == 200
    assert update_response.json() == {
        "provider": "gemini",
        "model": "gemini-test",
        "daily_token_limit": 6543,
        "cost_guard_enabled": False,
        "api_keys": [
            {
                "name": "Global Gemini",
                "key": "sk-admin-gemini",
                "provider": "gemini",
                "token_limit": 6543,
                "is_default": True,
            }
        ],
    }
    assert usage_response.status_code == 200
    assert usage_response.json()["items"][0]["function_type"] == "report"
    assert usage_response.json()["items"][0]["provider"] == "gemini"
    assert usage_response.json()["items"][0]["total_tokens"] == 175
    assert forbidden_response.status_code == 403


def test_admin_logs_endpoint(client: TestClient) -> None:
    """Admin logs endpoint supports filters, pagination, and role guards."""
    admin_token = _token(client, "admin-logs@example.com")
    user_token = _token(client, "regular-logs@example.com")
    source_id = asyncio.run(_seed_admin_logs_data(client))
    headers = _auth(admin_token)

    response = client.get("/api/v1/admin/logs", headers=headers)
    source_response = client.get(f"/api/v1/admin/logs?source_id={source_id}", headers=headers)
    success_response = client.get("/api/v1/admin/logs?status=success", headers=headers)
    fail_response = client.get("/api/v1/admin/logs?status=fail", headers=headers)
    date_response = client.get(
        "/api/v1/admin/logs",
        headers=headers,
        params={
            "date_from": "2026-01-02T00:00:00+00:00",
            "date_to": "2026-01-05T23:59:59+00:00",
        },
    )
    combined_response = client.get(
        "/api/v1/admin/logs",
        headers=headers,
        params={
            "source_id": source_id,
            "status": "success",
            "date_from": "2026-01-03T00:00:00+00:00",
        },
    )
    page_two_response = client.get("/api/v1/admin/logs?page=2&page_size=10", headers=headers)
    forbidden_response = client.get("/api/v1/admin/logs", headers=_auth(user_token))

    assert response.status_code == 200
    assert response.json()["page"] == 1
    assert response.json()["page_size"] == 50
    assert response.json()["total"] == 12
    assert response.json()["success_rate"] == 0.25

    assert source_response.status_code == 200
    assert source_response.json()["total"] == 4
    assert all(item["source_id"] == source_id for item in source_response.json()["items"])

    assert success_response.status_code == 200
    assert success_response.json()["total"] == 3
    assert all(item["status"] == "success" for item in success_response.json()["items"])

    assert fail_response.status_code == 200
    assert fail_response.json()["total"] == 2
    assert all(item["status"] == "fail" for item in fail_response.json()["items"])

    assert date_response.status_code == 200
    assert date_response.json()["total"] == 6

    assert combined_response.status_code == 200
    assert combined_response.json()["total"] == 2
    assert all(item["source_id"] == source_id for item in combined_response.json()["items"])
    assert all(item["status"] == "success" for item in combined_response.json()["items"])

    assert page_two_response.status_code == 200
    assert page_two_response.json()["page"] == 2
    assert page_two_response.json()["page_size"] == 10
    assert page_two_response.json()["total"] == 12
    assert page_two_response.json()["has_next"] is False
    assert len(page_two_response.json()["items"]) == 2

    assert forbidden_response.status_code == 403


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


async def _seed_admin_llm_usage(client: TestClient) -> None:
    session_factory = client.app.state.session_factory
    async with session_factory() as db:
        db.add(
            LLMUsageLog(
                provider="gemini",
                model="gemini-test",
                function_type=LLMFunctionType.REPORT,
                input_tokens=150,
                output_tokens=25,
                created_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()


async def _seed_admin_logs_data(client: TestClient) -> str:
    session_factory = client.app.state.session_factory
    source_a = DataSource(
        id=uuid4(),
        name="Admin Logs A",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://logs.test/a.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
        is_active=True,
    )
    source_b = DataSource(
        id=uuid4(),
        name="Admin Logs B",
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://logs.test/b.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
        is_active=True,
    )
    timestamps = [
        datetime(2026, 1, 5, 12, tzinfo=timezone.utc),
        datetime(2026, 1, 4, 12, tzinfo=timezone.utc),
        datetime(2026, 1, 3, 12, tzinfo=timezone.utc),
        datetime(2026, 1, 2, 12, tzinfo=timezone.utc),
        datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        datetime(2025, 12, 31, 12, tzinfo=timezone.utc),
        datetime(2025, 12, 30, 12, tzinfo=timezone.utc),
        datetime(2025, 12, 29, 12, tzinfo=timezone.utc),
        datetime(2025, 12, 28, 12, tzinfo=timezone.utc),
        datetime(2025, 12, 27, 12, tzinfo=timezone.utc),
        datetime(2025, 12, 26, 12, tzinfo=timezone.utc),
        datetime(2025, 12, 25, 12, tzinfo=timezone.utc),
    ]
    logs = [
        _collector_log(source_a.id, CollectorStatus.SUCCESS, timestamps[0]),
        _collector_log(source_a.id, CollectorStatus.FAIL, timestamps[1]),
        _collector_log(source_a.id, CollectorStatus.SUCCESS, timestamps[2]),
        _collector_log(source_a.id, CollectorStatus.TIMEOUT, timestamps[3]),
        _collector_log(source_b.id, CollectorStatus.SUCCESS, timestamps[0] - timedelta(hours=1)),
        _collector_log(source_b.id, CollectorStatus.FAIL, timestamps[1] - timedelta(hours=1)),
    ]
    logs.extend(_collector_log(source_b.id, CollectorStatus.TIMEOUT, timestamp) for timestamp in timestamps[6:])
    async with session_factory() as db:
        db.add_all([source_a, source_b, *logs])
        await db.commit()
    return str(source_a.id)


def _collector_log(source_id: UUID, status: CollectorStatus, executed_at: datetime) -> CollectorLog:
    return CollectorLog(
        source_id=source_id,
        status=status,
        items_count=5 if status == CollectorStatus.SUCCESS else 0,
        error_message=None if status == CollectorStatus.SUCCESS else status.value,
        duration_ms=100,
        executed_at=executed_at,
    )
