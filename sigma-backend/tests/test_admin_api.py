from fastapi.testclient import TestClient


def test_admin_dashboard_endpoints(client: TestClient) -> None:
    """Admin dashboard endpoints return machine-consumable payloads."""
    token = _token(client, "admin-dashboard@example.com")
    headers = _auth(token)

    stats = client.get("/api/v1/admin/dashboard/stats", headers=headers)
    stats_root = client.get("/api/v1/admin/dashboard", headers=headers)
    trend = client.get("/api/v1/admin/dashboard/collection-trend", headers=headers)
    activity = client.get("/api/v1/admin/dashboard/recent-activity", headers=headers)
    health = client.get("/api/v1/admin/dashboard/source-health", headers=headers)

    assert stats.status_code == 200
    assert stats.json()["users"] == 1
    assert stats_root.status_code == 200
    assert stats_root.json() == stats.json()
    assert trend.status_code == 200
    assert len(trend.json()) == 7
    assert activity.status_code == 200
    assert activity.json() == []
    assert health.status_code == 200


def test_admin_user_management_guards(client: TestClient) -> None:
    """Admins can manage other users but cannot modify themselves."""
    admin_token = _token(client, "admin-users@example.com")
    _token(client, "managed-user@example.com")
    headers = _auth(admin_token)

    list_response = client.get("/api/v1/admin/users?q=managed", headers=headers)
    user_id = list_response.json()["items"][0]["id"]
    self_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
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

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert update_response.status_code == 200
    assert update_response.json()["is_active"] is False
    assert self_response.status_code == 403
    assert delete_response.status_code == 204


def test_admin_source_preview_and_delete(client: TestClient, monkeypatch) -> None:
    """Admins can preview unsaved sources and delete system sources."""
    token = _token(client, "admin-sources@example.com")
    headers = _auth(token)

    class FakeCollector:
        async def collect(self) -> list[dict[str, object]]:
            return [{"title": "Preview", "content": "Text"}]

        async def validate_config(self) -> bool:
            return True

    monkeypatch.setattr("app.api.v1.admin.sources.create_collector", lambda _source: FakeCollector())
    payload = _source_payload("Admin RSS")
    preview_response = client.post("/api/v1/admin/sources/test", headers=headers, json=payload)
    create_response = client.post("/api/v1/admin/sources", headers=headers, json=payload)
    source_id = create_response.json()["id"]
    logs_response = client.get(f"/api/v1/admin/sources/{source_id}/logs", headers=headers)
    delete_response = client.delete(f"/api/v1/admin/sources/{source_id}", headers=headers)

    assert preview_response.status_code == 200
    assert preview_response.json()["items"][0]["title"] == "Preview"
    assert create_response.status_code == 201
    assert logs_response.status_code == 200
    assert logs_response.json()["items"] == []
    assert delete_response.status_code == 204


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
