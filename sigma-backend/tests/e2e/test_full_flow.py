import asyncio
from collections.abc import AsyncIterator
from datetime import date
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.analyzers.report_generator import generate_report
from app.analyzers.summarizer import batch_summarize
from app.database import get_db
from app.main import create_app
from app.models import Base
from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.report import Report
from app.scheduler.jobs import collect_from_source


def test_full_intelligence_flow(monkeypatch, tmp_path) -> None:
    """Exercise the complete admin-to-user intelligence flow with mocked I/O."""
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path / 'sigma-e2e.db'}",
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app = create_app(enable_scheduler=False)
    app.dependency_overrides[get_db] = override_get_db

    class FakeCollector:
        async def collect(self) -> list[dict[str, object]]:
            return [
                {
                    "title": "Fed guidance lifts chip stocks",
                    "content": "Semiconductors rally as rates stabilize and cloud demand expands.",
                    "url": "https://e2e.test/items/chips",
                }
            ]

        async def validate_config(self) -> bool:
            return True

    class FakeLLMClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        async def complete(self, _system_prompt: str, user_prompt: str, **_kwargs: object) -> str:
            if "report" in user_prompt.lower():
                return "## Overview\n\nChip demand is improving.\n\n## Outlook\n\nMonitor rates."
            return "Chip stocks rose on stable rates and AI infrastructure demand."

        async def complete_json(self, _system_prompt: str, user_prompt: str, **_kwargs: object) -> dict[str, object]:
            return {
                "sentiment": "bullish",
                "summary": "Chip stocks rose on stable rates and AI infrastructure demand.",
                "keywords": ["chips", "rates", "AI"],
            }

    async def fake_acquire(*_args: object, **_kwargs: object) -> bool:
        return True

    async def fake_release(*_args: object, **_kwargs: object) -> None:
        return None

    async def ignored_auto_summary(*_args: object, **_kwargs: object) -> None:
        return None

    monkeypatch.setattr("app.api.v1.routes.sources.create_collector", lambda _source: FakeCollector())
    monkeypatch.setattr("app.scheduler.jobs.create_collector", lambda _source: FakeCollector())
    monkeypatch.setattr("app.scheduler.jobs.acquire_lock", fake_acquire)
    monkeypatch.setattr("app.scheduler.jobs.release_lock", fake_release)
    monkeypatch.setattr("app.scheduler.jobs.batch_summarize", ignored_auto_summary)
    monkeypatch.setattr("app.analyzers.summarizer.LLMClient", FakeLLMClient)
    monkeypatch.setattr("app.analyzers.report_generator.LLMClient", FakeLLMClient)

    async def create_tables() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def drop_tables() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(create_tables())
    try:
        with TestClient(app) as client:
            admin_token = _register_and_login(client, "admin-e2e@example.com")
            admin_headers = _auth(admin_token)
            source_response = client.post(
                "/api/v1/sources",
                headers=admin_headers,
                json=_source_payload(),
            )
            assert source_response.status_code == 201
            source_id = UUID(source_response.json()["id"])

            preview_response = client.post(f"/api/v1/sources/{source_id}/test", headers=admin_headers)
            assert preview_response.status_code == 200
            assert preview_response.json()["items"][0]["title"] == "Fed guidance lifts chip stocks"

            asyncio.run(collect_from_source(source_id, session_factory))
            item_ids = asyncio.run(_item_ids(session_factory))
            assert len(item_ids) == 1

            asyncio.run(batch_summarize(item_ids, session_factory=session_factory))
            items_response = client.get("/api/v1/items?format=minimal", headers=admin_headers)
            assert items_response.status_code == 200
            assert items_response.json()["items"][0]["summary"].startswith("Chip stocks rose")

            report_id = asyncio.run(_generate_report(session_factory))
            report_response = client.get(f"/api/v1/reports/{report_id}", headers=admin_headers)
            assert report_response.status_code == 200
            assert "Chip demand is improving" in report_response.json()["content"]

            user_token = _register_and_login(client, "analyst-e2e@example.com")
            user_headers = _auth(user_token)
            watchlist_response = client.post(
                "/api/v1/watchlists",
                headers=user_headers,
                json={"name": "Chips", "keywords": ["chip"], "markets": ["us"], "sources": []},
            )
            assert watchlist_response.status_code == 201
            watchlist_id = watchlist_response.json()["id"]
            filtered_response = client.get(
                f"/api/v1/watchlists/{watchlist_id}/items",
                headers=user_headers,
            )
            assert filtered_response.status_code == 200
            assert filtered_response.json()["total"] == 1

            user_id = client.get("/api/v1/auth/me", headers=user_headers).json()["id"]
            disable_response = client.put(
                f"/api/v1/admin/users/{user_id}",
                headers=admin_headers,
                json={"is_active": False},
            )
            rejected_response = client.get("/api/v1/auth/me", headers=user_headers)
            logs_count = asyncio.run(_collector_log_count(session_factory))

            assert disable_response.status_code == 200
            assert rejected_response.status_code == 401
            assert logs_count == 1
    finally:
        asyncio.run(drop_tables())


def _register_and_login(client: TestClient, email: str) -> str:
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


def _source_payload() -> dict[str, object]:
    return {
        "name": "E2E RSS",
        "source_type": "rss",
        "category": "finance",
        "market": "us",
        "config": {"feed_url": "https://e2e.test/feed.xml"},
        "schedule_cron": "*/5 * * * *",
        "max_execution_seconds": 60,
        "is_active": True,
    }


async def _item_ids(session_factory: async_sessionmaker[AsyncSession]) -> list[UUID]:
    async with session_factory() as db:
        return list(await db.scalars(select(CollectedItem.id)))


async def _generate_report(session_factory: async_sessionmaker[AsyncSession]) -> UUID:
    async with session_factory() as db:
        report = await generate_report(db, "daily", ["us"], ["finance"], date.today(), date.today())
        await db.commit()
        return report.id


async def _collector_log_count(session_factory: async_sessionmaker[AsyncSession]) -> int:
    async with session_factory() as db:
        logs = list(await db.scalars(select(CollectorLog)))
        reports = list(await db.scalars(select(Report)))
        assert len(reports) == 1
        return len(logs)
