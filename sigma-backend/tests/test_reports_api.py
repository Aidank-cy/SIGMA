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
