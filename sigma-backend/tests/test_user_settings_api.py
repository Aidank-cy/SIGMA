import asyncio
from datetime import datetime, timezone
from uuid import UUID

from fastapi.testclient import TestClient

from app.models.enums import LLMFunctionType
from app.models.llm_usage_log import LLMUsageLog


def test_get_user_settings_returns_preferences(client: TestClient) -> None:
    """GET /me/settings returns profile, retention, and report preferences."""
    token = _token(client, "settings-get@example.com")

    response = client.get("/api/v1/me/settings", headers=_auth(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["display_name"] == "SIGMA User"
    assert payload["locale"] == "zh"
    assert payload["data_retention_days"] == 30
    assert payload["report_frequency"] == "daily"
    assert payload["report_frequencies"] == ["daily"]
    assert payload["max_tokens"]["daily_morning"] == 2000
    assert payload["markets"] == []
    assert payload["categories"] == []
    assert payload["is_active"] is True


def test_put_user_settings_updates_and_persists(client: TestClient) -> None:
    """PUT /me/settings updates all user preference fields atomically."""
    token = _token(client, "settings-put@example.com")
    headers = _auth(token)

    update_response = client.put(
        "/api/v1/me/settings",
        headers=headers,
        json={
            "display_name": "Updated Analyst",
            "locale": "en",
            "data_retention_days": 90,
            "report_frequency": "weekly",
            "report_frequencies": ["weekly"],
            "markets": ["us", "global"],
            "categories": ["finance"],
            "is_active": False,
            "max_tokens": {"weekly": 3200},
            "time_ranges": {
                "weekly": {
                    "start_day_offset": 7,
                    "end_day_offset": 0,
                    "start_time": "17:45",
                    "end_time": "17:44",
                }
            },
        },
    )
    get_response = client.get("/api/v1/me/settings", headers=headers)

    assert update_response.status_code == 200
    assert update_response.json() == get_response.json()
    assert get_response.json()["display_name"] == "Updated Analyst"
    assert get_response.json()["locale"] == "en"
    assert get_response.json()["data_retention_days"] == 90
    assert get_response.json()["report_frequency"] == "weekly"
    assert get_response.json()["report_frequencies"] == ["weekly"]
    assert get_response.json()["max_tokens"]["weekly"] == 3200
    assert get_response.json()["time_ranges"] == {
        "weekly": {
            "start_day_offset": 7,
            "end_day_offset": 0,
            "start_time": "17:45",
            "end_time": "17:44",
        }
    }
    assert get_response.json()["markets"] == ["us", "global"]
    assert get_response.json()["categories"] == ["finance"]
    assert get_response.json()["is_active"] is False


def test_user_settings_requires_auth(client: TestClient) -> None:
    """Unauthenticated /me/settings requests are rejected."""
    response = client.get("/api/v1/me/settings")

    assert response.status_code == 401


def test_report_profile_retention_and_password_endpoints(client: TestClient) -> None:
    """Users can update report config, profile, retention, and password settings."""
    token = _token(client, "settings-sections@example.com")
    headers = _auth(token)

    report_get = client.get("/api/v1/me/report-config", headers=headers)
    report_update = client.put(
        "/api/v1/me/report-config",
        headers=headers,
        json={
            "report_frequency": "monthly",
            "report_frequencies": ["monthly"],
            "markets": ["us", "cn"],
            "categories": ["finance", "macro"],
            "is_active": False,
            "max_tokens": {"monthly": 4500},
            "time_ranges": {"monthly": {"start_day_of_month": 1, "end_day_of_month": 28}},
        },
    )
    profile_response = client.put(
        "/api/v1/me/profile",
        headers=headers,
        json={"display_name": "Section User", "locale": "en"},
    )
    retention_response = client.put(
        "/api/v1/me/retention",
        headers=headers,
        json={"data_retention_days": 180},
    )
    wrong_password_response = client.put(
        "/api/v1/me/password",
        headers=headers,
        json={"current_password": "WrongPass1", "new_password": "BetterPass2"},
    )
    password_response = client.put(
        "/api/v1/me/password",
        headers=headers,
        json={"current_password": "StrongPass1", "new_password": "BetterPass2"},
    )
    old_login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "settings-sections@example.com", "password": "StrongPass1"},
    )
    new_login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "settings-sections@example.com", "password": "BetterPass2"},
    )

    assert report_get.status_code == 200
    assert report_get.json() == {
        "report_frequency": "daily",
        "report_frequencies": ["daily"],
        "markets": [],
        "categories": [],
        "is_active": True,
        "max_tokens": {
            "daily_morning": 2000,
            "daily_afternoon": 2000,
            "weekly": 3000,
            "monthly": 4000,
        },
        "time_ranges": {},
    }
    assert report_update.status_code == 200
    assert report_update.json() == {
        "report_frequency": "monthly",
        "report_frequencies": ["monthly"],
        "markets": ["us", "cn"],
        "categories": ["finance", "macro"],
        "is_active": False,
        "max_tokens": {
            "daily_morning": 2000,
            "daily_afternoon": 2000,
            "weekly": 3000,
            "monthly": 4500,
        },
        "time_ranges": {"monthly": {"start_day_of_month": 1, "end_day_of_month": 28}},
    }
    assert profile_response.status_code == 200
    assert profile_response.json()["display_name"] == "Section User"
    assert profile_response.json()["locale"] == "en"
    assert retention_response.status_code == 200
    assert retention_response.json()["data_retention_days"] == 180
    assert wrong_password_response.status_code == 400
    assert wrong_password_response.json()["detail"] == "Current password is incorrect"
    assert password_response.status_code == 204
    assert old_login_response.status_code == 401
    assert new_login_response.status_code == 200


def test_user_llm_config_and_usage(client: TestClient) -> None:
    """Authenticated users can read/update LLM config and inspect usage rollups."""
    token = _token(client, "settings-llm@example.com")
    headers = _auth(token)
    user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    asyncio.run(_seed_llm_usage(client, user_id))

    get_response = client.get("/api/v1/me/llm/config", headers=headers)
    update_response = client.put(
        "/api/v1/me/llm/config",
        headers=headers,
        json={
            "daily_token_limit": 4321,
            "cost_guard_enabled": False,
            "api_keys": [
                {
                    "name": "Personal",
                    "key": "sk-user-test",
                    "provider": "deepseek",
                    "token_limit": 4321,
                    "is_default": True,
                }
            ],
        },
    )
    minimal_update_response = client.put(
        "/api/v1/me/llm/config",
        headers=headers,
        json={
            "cost_guard_enabled": True,
            "api_keys": [
                {
                    "name": "Default Only",
                    "key": "sk-default-only",
                    "provider": "anthropic",
                    "token_limit": 100000,
                    "is_default": True,
                }
            ],
        },
    )
    usage_response = client.get("/api/v1/me/llm/usage", headers=headers)

    assert get_response.status_code == 200
    assert {"daily_token_limit", "cost_guard_enabled", "api_keys"}.issubset(get_response.json())
    assert "provider" not in get_response.json()
    assert "model" not in get_response.json()
    assert update_response.status_code == 200
    assert update_response.json()["daily_token_limit"] == 4321
    assert update_response.json()["cost_guard_enabled"] is False
    assert update_response.json()["api_keys"] == [
        {
            "name": "Personal",
            "key": "sk-user-test",
            "provider": "deepseek",
            "token_limit": 4321,
            "is_default": True,
        }
    ]
    assert minimal_update_response.status_code == 200
    assert minimal_update_response.json()["daily_token_limit"] == 4321
    assert minimal_update_response.json()["api_keys"][0]["is_default"] is True
    assert usage_response.status_code == 200
    usage_items = usage_response.json()["items"]
    assert len(usage_items) == 1
    assert usage_items[0]["function_type"] == "summary"
    assert usage_items[0]["provider"] == "deepseek"
    assert usage_items[0]["model"] == "deepseek-test"
    assert usage_items[0]["input_tokens"] == 100
    assert usage_items[0]["output_tokens"] == 25
    assert usage_items[0]["total_tokens"] == 125


def _token(client: TestClient, email: str) -> str:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPass1", "display_name": "SIGMA User"},
    )
    assert register_response.status_code == 201
    return str(register_response.json()["access_token"])


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _seed_llm_usage(client: TestClient, user_id: str) -> None:
    session_factory = client.app.state.session_factory
    async with session_factory() as db:
        db.add_all(
            [
                LLMUsageLog(
                    provider="deepseek",
                    model="deepseek-test",
                    user_id=UUID(user_id),
                    function_type=LLMFunctionType.SUMMARY,
                    input_tokens=100,
                    output_tokens=25,
                    created_at=datetime.now(timezone.utc),
                ),
                LLMUsageLog(
                    provider="openai",
                    model="system-test",
                    user_id=None,
                    function_type=LLMFunctionType.REPORT,
                    input_tokens=999,
                    output_tokens=1,
                    created_at=datetime.now(timezone.utc),
                ),
            ]
        )
        await db.commit()
