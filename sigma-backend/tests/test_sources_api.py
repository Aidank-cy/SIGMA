import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import CollectorStatus, IntelligenceCategory, Market, SourceType


def test_sources_create_list_and_delete(client: TestClient) -> None:
    """Users can create, list, and delete their own sources."""
    token = _token(client, "owner@example.com")

    empty_response = client.get("/api/v1/sources", headers=_auth(token))
    assert empty_response.status_code == 200
    assert empty_response.json()["items"] == []

    response = client.post(
        "/api/v1/sources",
        headers=_auth(token),
        json=_source_payload("Owner RSS"),
    )

    assert response.status_code == 201
    source_id = response.json()["id"]

    list_response = client.get("/api/v1/sources", headers=_auth(token))
    assert list_response.status_code == 200
    list_payload = list_response.json()
    assert list_payload["page"] == 1
    assert list_payload["page_size"] == 20
    assert list_payload["total"] == 1
    assert list_payload["has_next"] is False
    assert list_payload["items"][0]["id"] == source_id

    delete_response = client.delete(f"/api/v1/sources/{source_id}", headers=_auth(token))
    assert delete_response.status_code == 204


def test_source_update_status_and_auth_edges(client: TestClient) -> None:
    """Source update and status endpoints follow the current HTTP contract."""
    token = _token(client, "status@example.com")
    create_response = client.post(
        "/api/v1/sources",
        headers=_auth(token),
        json=_source_payload("Status RSS"),
    )
    assert create_response.status_code == 201
    source_id = create_response.json()["id"]

    update_response = client.put(
        f"/api/v1/sources/{source_id}",
        headers=_auth(token),
        json={
            "name": "Updated Status RSS",
            "category": "macro",
            "market": "global",
            "config": {"feed_url": "https://rss.test/updated.xml"},
            "schedule_cron": "*/10 * * * *",
            "max_execution_seconds": 120,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["id"] == source_id
    assert updated["name"] == "Updated Status RSS"
    assert updated["category"] == "macro"
    assert updated["market"] == "global"
    assert updated["config"]["feed_url"] == "https://rss.test/updated.xml"
    assert updated["max_execution_seconds"] == 120

    _seed_collector_log(client, source_id)
    status_response = client.get(f"/api/v1/sources/{source_id}/status", headers=_auth(token))
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["last_status"] == "success"
    assert status_payload["last_error"] is None
    assert status_payload["last_executed_at"] is not None
    assert status_payload["success_rate_24h"] == 1.0

    unauthorized_response = client.get("/api/v1/sources")
    assert unauthorized_response.status_code == 401


def test_delete_system_source_forbidden(client: TestClient) -> None:
    """System sources cannot be deleted through user CRUD."""
    token = _token(client, "admin@example.com")
    source_id = asyncio.run(_seed_system_source(client, "System RSS"))

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


def test_source_logs_endpoint_scopes_logs_to_visible_sources(client: TestClient) -> None:
    """Source logs are available to regular users and scoped to their visible sources."""
    _token(client, "logs-admin@example.com")
    owner_token = _token(client, "logs-owner@example.com")
    other_token = _token(client, "logs-other@example.com")
    owner_source = client.post(
        "/api/v1/sources",
        headers=_auth(owner_token),
        json=_source_payload("Owner Logs RSS"),
    ).json()["id"]
    other_source = client.post(
        "/api/v1/sources",
        headers=_auth(other_token),
        json=_source_payload("Other Logs RSS"),
    ).json()["id"]
    asyncio.run(_seed_collector_logs(client, owner_source, other_source))

    response = client.get("/api/v1/sources/logs?page=1&page_size=10", headers=_auth(owner_token))
    success_response = client.get("/api/v1/sources/logs?status=success", headers=_auth(owner_token))
    hidden_source_response = client.get(f"/api/v1/sources/logs?source_id={other_source}", headers=_auth(owner_token))
    unauthenticated_response = client.get("/api/v1/sources/logs")

    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert response.json()["success_rate"] == 0.5
    assert {item["source_id"] for item in response.json()["items"]} == {owner_source}
    assert success_response.status_code == 200
    assert success_response.json()["total"] == 1
    assert success_response.json()["items"][0]["status"] == "success"
    assert hidden_source_response.status_code == 200
    assert hidden_source_response.json()["total"] == 0
    assert unauthenticated_response.status_code == 401


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


def _seed_collector_log(client: TestClient, source_id: str) -> None:
    asyncio.run(_seed_collector_log_async(client, source_id))


async def _seed_system_source(client: TestClient, name: str) -> str:
    session_factory = client.app.state.session_factory
    source = DataSource(
        id=uuid4(),
        name=name,
        source_type=SourceType.RSS,
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        config={"feed_url": "https://rss.test/system.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
        is_active=True,
        is_system=True,
    )
    async with session_factory() as db:
        db.add(source)
        await db.commit()
    return str(source.id)


async def _seed_collector_log_async(client: TestClient, source_id: str) -> None:
    session_factory = client.app.state.session_factory
    async with session_factory() as db:
        db.add(
            CollectorLog(
                source_id=UUID(source_id),
                status=CollectorStatus.SUCCESS,
                items_count=4,
                error_message=None,
                duration_ms=250,
                executed_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()


async def _seed_collector_logs(client: TestClient, owner_source: str, other_source: str) -> None:
    session_factory = client.app.state.session_factory
    now = datetime.now(timezone.utc)
    async with session_factory() as db:
        db.add_all(
            [
                CollectorLog(
                    source_id=UUID(owner_source),
                    status=CollectorStatus.SUCCESS,
                    items_count=4,
                    error_message=None,
                    duration_ms=250,
                    executed_at=now,
                ),
                CollectorLog(
                    source_id=UUID(owner_source),
                    status=CollectorStatus.FAIL,
                    items_count=0,
                    error_message="fail",
                    duration_ms=150,
                    executed_at=now - timedelta(minutes=5),
                ),
                CollectorLog(
                    source_id=UUID(other_source),
                    status=CollectorStatus.SUCCESS,
                    items_count=3,
                    error_message=None,
                    duration_ms=175,
                    executed_at=now - timedelta(minutes=10),
                ),
            ]
        )
        await db.commit()
