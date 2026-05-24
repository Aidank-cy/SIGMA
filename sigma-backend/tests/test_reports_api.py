import asyncio
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.v1.routes import reports as reports_routes
from app.models.enums import ReportType
from app.models.report import Report


def test_reports_list_and_latest_empty(client: TestClient) -> None:
    """Report list endpoints return paginated empty payloads."""
    list_response = client.get("/api/v1/reports")
    latest_response = client.get("/api/v1/reports/latest")

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0
    assert latest_response.status_code == 200
    assert latest_response.json()["items"] == []


def test_reports_http_filters_latest_detail_and_generation(client: TestClient, monkeypatch) -> None:
    """Report HTTP endpoints expose pagination, filters, latest reports, details, and admin generation."""
    seeded = _seed_reports(client)

    list_response = client.get("/api/v1/reports?page=1&page_size=5")
    assert list_response.status_code == 200
    list_payload = list_response.json()
    assert list_payload["page"] == 1
    assert list_payload["page_size"] == 5
    assert list_payload["total"] == 4
    assert list_payload["has_next"] is False

    daily_response = client.get("/api/v1/reports?report_type=daily")
    assert daily_response.status_code == 200
    assert {item["report_type"] for item in daily_response.json()["items"]} == {"daily"}

    market_response = client.get("/api/v1/reports?market=us")
    assert market_response.status_code == 200
    assert all("us" in item["market_scope"] for item in market_response.json()["items"])

    date_response = client.get(
        "/api/v1/reports",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31"},
    )
    assert date_response.status_code == 200
    assert {item["title"] for item in date_response.json()["items"]} == {
        "Newest daily report",
        "Older daily report",
        "Weekly US report",
    }

    latest_response = client.get("/api/v1/reports/latest")
    assert latest_response.status_code == 200
    latest_by_type = {item["report_type"]: item["title"] for item in latest_response.json()["items"]}
    assert latest_by_type == {
        "daily": "Newest daily report",
        "weekly": "Weekly US report",
        "monthly": "Monthly CN report",
    }

    detail_response = client.get(f"/api/v1/reports/{seeded['daily_id']}")
    missing_response = client.get(f"/api/v1/reports/{uuid4()}")
    assert detail_response.status_code == 200
    assert detail_response.json()["content"] == "# Daily\nFull content"
    assert missing_response.status_code == 404

    async def fake_generate_task(_payload: object) -> None:
        return None

    monkeypatch.setattr(reports_routes, "_generate_report_task", fake_generate_task)

    admin_token = _token(client, "report-admin@example.com")
    user_token = _token(client, "report-non-admin@example.com")
    generate_payload = {
        "report_type": "daily",
        "market_scope": ["us"],
        "category_scope": ["finance"],
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "locale": "en",
    }
    admin_generate = client.post("/api/v1/reports/generate", headers=_auth(admin_token), json=generate_payload)
    user_generate = client.post("/api/v1/reports/generate", headers=_auth(user_token), json=generate_payload)

    assert admin_generate.status_code == 202
    assert admin_generate.json() == {"status": "accepted"}
    assert user_generate.status_code == 403


def test_user_report_config_crud(client: TestClient) -> None:
    """Users can read and update their report configuration."""
    token = _token(client, "report-user@example.com")

    get_response = client.get("/api/v1/me/report-config", headers=_auth(token))
    update_response = client.put(
        "/api/v1/me/report-config",
        headers=_auth(token),
        json={
            "report_frequency": "weekly",
            "markets": ["us", "global"],
            "categories": ["finance"],
            "is_active": True,
        },
    )

    assert get_response.status_code == 200
    assert get_response.json()["report_frequency"] == "daily"
    assert update_response.status_code == 200
    assert update_response.json()["report_frequency"] == "weekly"
    assert update_response.json()["markets"] == ["us", "global"]


def test_user_profile_retention_and_password_updates(client: TestClient) -> None:
    """Users can update independent settings sections."""
    token = _token(client, "settings-user@example.com")

    profile_response = client.put(
        "/api/v1/me/profile",
        headers=_auth(token),
        json={"display_name": "Updated User", "locale": "en"},
    )
    retention_response = client.put(
        "/api/v1/me/retention",
        headers=_auth(token),
        json={"data_retention_days": 90},
    )
    password_response = client.put(
        "/api/v1/me/password",
        headers=_auth(token),
        json={"current_password": "StrongPass1", "new_password": "BetterPass2"},
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "settings-user@example.com", "password": "BetterPass2"},
    )

    assert profile_response.status_code == 200
    assert profile_response.json()["display_name"] == "Updated User"
    assert profile_response.json()["locale"] == "en"
    assert retention_response.status_code == 200
    assert retention_response.json()["data_retention_days"] == 90
    assert password_response.status_code == 204
    assert login_response.status_code == 200


def test_admin_llm_config_and_usage(client: TestClient) -> None:
    """Admins can update LLM config and read usage rollups."""
    token = _token(client, "llm-admin@example.com")

    update_response = client.put(
        "/api/v1/admin/llm/config",
        headers=_auth(token),
        json={
            "provider": "openai",
            "model": "gpt-test",
            "daily_token_limit": 12345,
            "api_keys": [
                {
                    "name": "Operations",
                    "key": "sk-admin-test",
                    "provider": "openai",
                    "token_limit": 12345,
                    "is_default": True,
                }
            ],
        },
    )
    get_response = client.get("/api/v1/admin/llm/config", headers=_auth(token))
    usage_response = client.get("/api/v1/admin/llm/usage", headers=_auth(token))

    assert update_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.json()["provider"] == "openai"
    assert get_response.json()["model"] == "gpt-test"
    assert get_response.json()["api_keys"] == [
        {
            "name": "Operations",
            "key": "sk-admin-test",
            "provider": "openai",
            "token_limit": 12345,
            "is_default": True,
        }
    ]
    assert usage_response.status_code == 200
    assert usage_response.json()["items"] == []


def test_user_llm_config_and_usage(client: TestClient) -> None:
    """Authenticated users can update personal LLM API keys and read usage rollups."""
    token = _token(client, "llm-user@example.com")
    second_token = _token(client, "llm-second-user@example.com")

    update_response = client.put(
        "/api/v1/me/llm/config",
        headers=_auth(token),
        json={
            "provider": "anthropic",
            "model": "claude-test",
            "daily_token_limit": 67890,
            "cost_guard_enabled": False,
            "api_keys": [
                {
                    "name": "Work",
                    "key": "sk-work-test",
                    "provider": "anthropic",
                    "token_limit": 25000,
                    "is_default": True,
                },
                {
                    "name": "Personal",
                    "key": "sk-personal-test",
                    "provider": "openai",
                    "token_limit": 50000,
                    "is_default": False,
                },
            ],
        },
    )
    second_update_response = client.put(
        "/api/v1/me/llm/config",
        headers=_auth(second_token),
        json={
            "provider": "anthropic",
            "model": "claude-test",
            "daily_token_limit": 67890,
            "cost_guard_enabled": False,
            "api_keys": [
                {
                    "name": "GPT-4 key",
                    "key": "sk-second-test",
                    "provider": "openai",
                    "token_limit": 12000,
                    "is_default": True,
                }
            ],
        },
    )
    get_response = client.get("/api/v1/me/llm/config", headers=_auth(token))
    edited_response = client.put(
        "/api/v1/me/llm/config",
        headers=_auth(token),
        json={
            "provider": "anthropic",
            "model": "claude-test",
            "daily_token_limit": 67890,
            "cost_guard_enabled": False,
            "api_keys": [
                {
                    "name": "Work renamed",
                    "key": "sk-work-updated",
                    "provider": "anthropic",
                    "token_limit": 30000,
                    "is_default": True,
                }
            ],
        },
    )
    edited_get_response = client.get("/api/v1/me/llm/config", headers=_auth(token))
    second_get_response = client.get("/api/v1/me/llm/config", headers=_auth(second_token))
    usage_response = client.get("/api/v1/me/llm/usage", headers=_auth(token))

    assert update_response.status_code == 200
    assert second_update_response.status_code == 200
    assert edited_response.status_code == 200
    assert update_response.json()["cost_guard_enabled"] is False
    assert get_response.status_code == 200
    assert get_response.json()["model"] == "claude-test"
    assert get_response.json()["api_keys"] == [
        {
            "name": "Work",
            "key": "sk-work-test",
            "provider": "anthropic",
            "token_limit": 25000,
            "is_default": True,
        },
        {
            "name": "Personal",
            "key": "sk-personal-test",
            "provider": "openai",
            "token_limit": 50000,
            "is_default": False,
        },
    ]
    assert edited_get_response.json()["api_keys"] == [
        {
            "name": "Work renamed",
            "key": "sk-work-updated",
            "provider": "anthropic",
            "token_limit": 30000,
            "is_default": True,
        }
    ]
    assert second_get_response.json()["api_keys"] == [
        {
            "name": "GPT-4 key",
            "key": "sk-second-test",
            "provider": "openai",
            "token_limit": 12000,
            "is_default": True,
        }
    ]
    assert usage_response.status_code == 200
    assert usage_response.json()["items"] == []


def test_user_llm_config_requires_auth(client: TestClient) -> None:
    """User-level LLM settings still require authentication."""
    response = client.get("/api/v1/me/llm/config")

    assert response.status_code == 401


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


def _seed_reports(client: TestClient) -> dict[str, str]:
    return asyncio.run(_seed_reports_async(client))


async def _seed_reports_async(client: TestClient) -> dict[str, str]:
    session_factory = client.app.state.session_factory
    generated_base = datetime(2026, 2, 1, 12, 0, tzinfo=UTC)
    reports = [
        _report(
            ReportType.DAILY,
            "Newest daily report",
            ["us"],
            ["finance"],
            date(2026, 1, 15),
            date(2026, 1, 31),
            generated_base,
            "# Daily\nFull content",
        ),
        _report(
            ReportType.DAILY,
            "Older daily report",
            ["us"],
            ["macro"],
            date(2026, 1, 1),
            date(2026, 1, 7),
            generated_base - timedelta(days=1),
            "# Older",
        ),
        _report(
            ReportType.WEEKLY,
            "Weekly US report",
            ["us"],
            ["finance"],
            date(2026, 1, 8),
            date(2026, 1, 14),
            generated_base - timedelta(hours=1),
            "# Weekly",
        ),
        _report(
            ReportType.MONTHLY,
            "Monthly CN report",
            ["cn"],
            ["technology"],
            date(2025, 12, 1),
            date(2025, 12, 31),
            generated_base - timedelta(hours=2),
            "# Monthly",
        ),
    ]
    async with session_factory() as db:
        db.add_all(reports)
        await db.commit()
        for report in reports:
            await db.refresh(report)
    return {"daily_id": str(reports[0].id)}


def _report(
    report_type: ReportType,
    title: str,
    markets: list[str],
    categories: list[str],
    period_start: date,
    period_end: date,
    generated_at: datetime,
    content: str,
) -> Report:
    return Report(
        report_type=report_type,
        title=title,
        content=content,
        market_scope=markets,
        category_scope=categories,
        period_start=period_start,
        period_end=period_end,
        generated_at=generated_at,
        item_count=3,
        sentiment_score=0.6,
    )
