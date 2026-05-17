from fastapi.testclient import TestClient


def test_reports_list_and_latest_empty(client: TestClient) -> None:
    """Report list endpoints return paginated empty payloads."""
    list_response = client.get("/api/v1/reports")
    latest_response = client.get("/api/v1/reports/latest")

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0
    assert latest_response.status_code == 200
    assert latest_response.json()["items"] == []


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
        json={"provider": "openai", "model": "gpt-test", "daily_token_limit": 12345},
    )
    get_response = client.get("/api/v1/admin/llm/config", headers=_auth(token))
    usage_response = client.get("/api/v1/admin/llm/usage", headers=_auth(token))

    assert update_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.json()["provider"] == "openai"
    assert get_response.json()["model"] == "gpt-test"
    assert usage_response.status_code == 200
    assert usage_response.json()["items"] == []


def test_user_llm_config_and_usage(client: TestClient) -> None:
    """Authenticated users can update shared LLM config and read usage rollups."""
    token = _token(client, "llm-user@example.com")

    update_response = client.put(
        "/api/v1/me/llm/config",
        headers=_auth(token),
        json={
            "provider": "anthropic",
            "model": "claude-test",
            "daily_token_limit": 67890,
            "cost_guard_enabled": False,
        },
    )
    get_response = client.get("/api/v1/me/llm/config", headers=_auth(token))
    usage_response = client.get("/api/v1/me/llm/usage", headers=_auth(token))

    assert update_response.status_code == 200
    assert update_response.json()["cost_guard_enabled"] is False
    assert get_response.status_code == 200
    assert get_response.json()["model"] == "claude-test"
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
