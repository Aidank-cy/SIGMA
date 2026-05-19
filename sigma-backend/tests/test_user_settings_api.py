from fastapi.testclient import TestClient


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
            "markets": ["us", "global"],
            "categories": ["finance"],
            "is_active": False,
        },
    )
    get_response = client.get("/api/v1/me/settings", headers=headers)

    assert update_response.status_code == 200
    assert update_response.json() == get_response.json()
    assert get_response.json()["display_name"] == "Updated Analyst"
    assert get_response.json()["locale"] == "en"
    assert get_response.json()["data_retention_days"] == 90
    assert get_response.json()["report_frequency"] == "weekly"
    assert get_response.json()["markets"] == ["us", "global"]
    assert get_response.json()["categories"] == ["finance"]
    assert get_response.json()["is_active"] is False


def test_user_settings_requires_auth(client: TestClient) -> None:
    """Unauthenticated /me/settings requests are rejected."""
    response = client.get("/api/v1/me/settings")

    assert response.status_code == 401


def _token(client: TestClient, email: str) -> str:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPass1", "display_name": "SIGMA User"},
    )
    assert register_response.status_code == 201
    return str(register_response.json()["access_token"])


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
