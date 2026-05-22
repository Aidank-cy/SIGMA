from types import SimpleNamespace

from fastapi.testclient import TestClient


def test_sources_create_list_and_delete(client: TestClient) -> None:
    """Users can create, list, and delete their own sources."""
    token = _token(client, "owner@example.com")
    response = client.post(
        "/api/v1/sources",
        headers=_auth(token),
        json=_source_payload("Owner RSS"),
    )

    assert response.status_code == 201
    source_id = response.json()["id"]

    list_response = client.get("/api/v1/sources", headers=_auth(token))
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1

    delete_response = client.delete(f"/api/v1/sources/{source_id}", headers=_auth(token))
    assert delete_response.status_code == 204


def test_delete_system_source_forbidden(client: TestClient) -> None:
    """System sources cannot be deleted through user CRUD."""
    token = _token(client, "admin@example.com")
    create_response = client.post(
        "/api/v1/admin/sources",
        headers=_auth(token),
        json=_source_payload("System RSS"),
    )
    assert create_response.status_code == 201
    source_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/v1/sources/{source_id}", headers=_auth(token))

    assert delete_response.status_code == 403


def test_source_test_returns_preview(client: TestClient, monkeypatch) -> None:
    """Source test endpoint returns collector previews without persistence."""
    token = _token(client, "preview@example.com")
    create_response = client.post(
        "/api/v1/sources",
        headers=_auth(token),
        json=_source_payload("Preview RSS"),
    )
    source_id = create_response.json()["id"]

    class FakeCollector:
        async def collect(self) -> list[dict[str, object]]:
            return [{"title": "Preview", "content": "Text"}]

        async def validate_config(self) -> bool:
            return True

    monkeypatch.setattr("app.api.v1.routes.sources.create_collector", lambda _source: FakeCollector())

    response = client.post(f"/api/v1/sources/{source_id}/test", headers=_auth(token))

    assert response.status_code == 200
    assert response.json()["items"][0]["title"] == "Preview"


def test_source_collect_queues_background_collection(client: TestClient, monkeypatch) -> None:
    """Source collect endpoint queues the real collection job."""
    token = _token(client, "collect@example.com")
    create_response = client.post(
        "/api/v1/sources",
        headers=_auth(token),
        json=_source_payload("Collect RSS"),
    )
    source_id = create_response.json()["id"]
    queued: list[str] = []

    def fake_collect_from_source(queued_source_id):
        queued.append(str(queued_source_id))

        async def noop() -> None:
            return None

        return noop()

    def fake_create_task(coro):
        coro.close()
        return object()

    monkeypatch.setattr("app.api.v1.routes.sources.collect_from_source", fake_collect_from_source)
    monkeypatch.setattr("app.api.v1.routes.sources.asyncio", SimpleNamespace(create_task=fake_create_task))

    response = client.post(f"/api/v1/sources/{source_id}/collect", headers=_auth(token))

    assert response.status_code == 200
    assert response.json() == {"status": "queued", "source_id": source_id}
    assert queued == [source_id]


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
