from fastapi.testclient import TestClient


def test_login_rate_limit_returns_429(client: TestClient) -> None:
    """Login is throttled after ten attempts per minute from one IP."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "limit@example.com", "password": "StrongPass1", "display_name": "Limited"},
    )

    responses = [
        client.post(
            "/api/v1/auth/login",
            json={"email": "limit@example.com", "password": "wrong-pass"},
        )
        for _ in range(11)
    ]

    assert responses[-1].status_code == 429
    assert responses[-1].headers["Retry-After"] == "60"


def test_weak_password_is_rejected(client: TestClient) -> None:
    """Registration rejects passwords without the configured strength."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "weak@example.com", "password": "password", "display_name": "Weak"},
    )

    assert response.status_code == 422


def test_invalid_bearer_token_is_rejected_on_public_api(client: TestClient) -> None:
    """Public routes reject malformed bearer credentials when supplied."""
    response = client.get("/api/v1/items", headers={"Authorization": "Bearer invalid-garbage-token"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid token"}
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.headers["Content-Security-Policy"]


def test_non_admin_cannot_access_admin_dashboard(client: TestClient) -> None:
    """The Layer 4 admin dashboard route rejects non-admin users."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "admin-owner@example.com", "password": "StrongPass1", "display_name": "Admin"},
    )
    client.post(
        "/api/v1/auth/register",
        json={"email": "regular-user@example.com", "password": "StrongPass1", "display_name": "User"},
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "regular-user@example.com", "password": "StrongPass1"},
    )
    token = login_response.json()["access_token"]

    response = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403


def test_security_headers_and_cors_are_applied(client: TestClient) -> None:
    """API responses include security headers and configured CORS origin."""
    response = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"
    assert "Content-Security-Policy" in response.headers
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"


def test_cors_rejects_unknown_origin_preflight(client: TestClient) -> None:
    """Unknown browser origins are rejected by CORS preflight handling."""
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 400
    assert "Access-Control-Allow-Origin" not in response.headers


def test_cors_preflight_does_not_consume_api_rate_limit(client: TestClient) -> None:
    """Browser preflight requests should not exhaust the general API quota."""
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "PUT",
    }

    responses = [client.options("/api/v1/me/profile", headers=headers) for _ in range(130)]

    assert all(response.status_code == 200 for response in responses)
    assert client.get("/api/v1/health").status_code == 200


def test_source_config_strips_script_tags(client: TestClient) -> None:
    """Data source config removes script payloads before persistence."""
    token = _token(client)
    response = client.post(
        "/api/v1/sources",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Sanitized RSS",
            "source_type": "rss",
            "category": "finance",
            "market": "us",
            "config": {
                "feed_url": "https://rss.test/feed.xml<script>alert(1)</script>",
                "nested": {"label": "<script>bad()</script>clean"},
            },
            "schedule_cron": "*/5 * * * *",
            "max_execution_seconds": 60,
            "is_active": True,
        },
    )

    assert response.status_code == 201
    config = response.json()["config"]
    assert config["feed_url"] == "https://rss.test/feed.xml"
    assert config["nested"]["label"] == "clean"


def _token(client: TestClient) -> str:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": "security-admin@example.com", "password": "StrongPass1", "display_name": "Admin"},
    )
    assert register_response.status_code == 201
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "security-admin@example.com", "password": "StrongPass1"},
    )
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])
