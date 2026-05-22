from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from jose import jwt

from app.api.v1.routes import auth as auth_routes
from app.core.config import settings
from app.services.auth_service import ALGORITHM


class FakeRedis:
    """Small async Redis stand-in for password reset tests."""

    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        self.values[key] = value
        return True

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def delete(self, key: str) -> int:
        existed = key in self.values
        self.values.pop(key, None)
        return int(existed)

    async def aclose(self) -> None:
        return None


def register_user(client: TestClient, email: str) -> dict[str, str]:
    """Register a user and return the response payload."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPass1",
            "display_name": "SIGMA User",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_register_first_is_admin(client: TestClient) -> None:
    """The first registered user receives admin role."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@example.com",
            "password": "StrongPass1",
            "display_name": "SIGMA User",
        },
    )
    payload = response.json()

    assert response.status_code == 201
    assert payload["email"] == "admin@example.com"
    assert payload["role"] == "admin"
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert "refresh_token" in response.cookies
    assert "hashed_password" not in payload


def test_register_accepts_username_alias(client: TestClient) -> None:
    """Registration accepts workflow-style username as display name."""
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "sectest", "email": "sec-alias@example.com", "password": "StrongPass1"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["display_name"] == "sectest"
    assert payload["access_token"]


def test_register_preserves_requested_locale(client: TestClient) -> None:
    """Registration stores the locale submitted by the active frontend locale."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "English User",
            "email": "en-user@example.com",
            "locale": "en",
            "password": "StrongPass1",
        },
    )

    assert response.status_code == 201
    assert response.json()["locale"] == "en"


def test_register_second_is_user(client: TestClient) -> None:
    """Subsequent registered users receive user role."""
    register_user(client, "admin@example.com")
    payload = register_user(client, "user@example.com")

    assert payload["role"] == "user"


def test_register_duplicate_email_returns_409(client: TestClient) -> None:
    """Duplicate registration emails are rejected without creating a second user."""
    register_user(client, "duplicate@example.com")

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "StrongPass1",
            "display_name": "Duplicate",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"


def test_register_missing_password_returns_422(client: TestClient) -> None:
    """Registration requires a password field."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "missing-password@example.com", "display_name": "Missing"},
    )

    assert response.status_code == 422


def test_register_weak_password_returns_422(client: TestClient) -> None:
    """Registration enforces the current letter-and-digit password rule."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak-password@example.com",
            "password": "password",
            "display_name": "Weak",
        },
    )

    assert response.status_code == 422


def test_login_success(client: TestClient) -> None:
    """Valid credentials return access and refresh credentials."""
    register_user(client, "user@example.com")

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "StrongPass1"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["token_type"] == "bearer"
    assert "refresh_token" in response.cookies
    assert "Path=/" in response.headers["set-cookie"]


def test_login_wrong_password_401(client: TestClient) -> None:
    """Invalid credentials are rejected."""
    register_user(client, "user@example.com")

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "WrongPass1"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_nonexistent_email_401(client: TestClient) -> None:
    """Unknown login emails use the same invalid credentials response."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "StrongPass1"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_deactivated_user_401(client: TestClient) -> None:
    """Inactive users cannot log in."""
    admin = register_user(client, "admin@example.com")
    user = register_user(client, "inactive@example.com")

    update_response = client.put(
        f"/api/v1/admin/users/{user['id']}",
        headers={"Authorization": f"Bearer {admin['access_token']}"},
        json={"is_active": False},
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "inactive@example.com", "password": "StrongPass1"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["is_active"] is False
    assert login_response.status_code == 401


def test_refresh_token_with_valid_cookie_returns_new_access_token(client: TestClient) -> None:
    """A valid refresh cookie issues a new access token."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "refresh@example.com",
            "password": "StrongPass1",
            "display_name": "Refresh",
        },
    )

    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.json()["refresh_token"] is None


def test_refresh_token_missing_cookie_returns_401(client: TestClient) -> None:
    """Refresh requires the httpOnly refresh cookie."""
    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing refresh token"


def test_refresh_token_invalid_cookie_returns_401(client: TestClient) -> None:
    """Malformed refresh cookies are rejected."""
    client.cookies.set("refresh_token", "not-a-token")

    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


def test_me_with_valid_token(client: TestClient) -> None:
    """Bearer access token authorizes /me."""
    register_user(client, "user@example.com")
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "StrongPass1"},
    )
    token = login_response.json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_me_without_token_401(client: TestClient) -> None:
    """Missing bearer token is rejected."""
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_with_expired_token_401(client: TestClient) -> None:
    """Expired bearer access tokens are rejected."""
    user = register_user(client, "expired@example.com")
    expired_token = jwt.encode(
        {
            "sub": user["id"],
            "role": user["role"],
            "email": user["email"],
            "type": "access",
            "exp": datetime.now(UTC) - timedelta(minutes=1),
        },
        settings.jwt_secret_key,
        algorithm=ALGORITHM,
    )

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})

    assert response.status_code == 401


def test_request_password_reset_returns_200(client: TestClient, monkeypatch) -> None:
    """Password reset request does not expose whether the email exists."""
    redis = FakeRedis()
    monkeypatch.setattr(auth_routes, "create_redis_client", lambda: redis)
    register_user(client, "reset@example.com")

    response = client.post("/api/v1/auth/request-password-reset", json={"email": "reset@example.com"})
    missing_response = client.post("/api/v1/auth/request-password-reset", json={"email": "missing@example.com"})

    assert response.status_code == 200
    assert response.json() == {"message": "verification code sent"}
    assert missing_response.status_code == 200
    assert "pwd_reset:reset@example.com" in redis.values
    assert "pwd_reset:missing@example.com" not in redis.values


def test_verify_correct_code_returns_token(client: TestClient, monkeypatch) -> None:
    """A matching verification code returns a short-lived reset token."""
    redis = FakeRedis()
    monkeypatch.setattr(auth_routes, "create_redis_client", lambda: redis)
    register_user(client, "verify@example.com")
    client.post("/api/v1/auth/request-password-reset", json={"email": "verify@example.com"})
    code = redis.values["pwd_reset:verify@example.com"]

    response = client.post("/api/v1/auth/verify-reset-code", json={"email": "verify@example.com", "code": code})

    assert response.status_code == 200
    payload = response.json()
    assert payload["reset_token"]
    assert payload["token_type"] == "bearer"
    assert payload["expires_in"] == 300


def test_verify_wrong_code_returns_401(client: TestClient, monkeypatch) -> None:
    """An incorrect verification code is rejected."""
    redis = FakeRedis()
    monkeypatch.setattr(auth_routes, "create_redis_client", lambda: redis)
    register_user(client, "wrong-code@example.com")
    client.post("/api/v1/auth/request-password-reset", json={"email": "wrong-code@example.com"})

    response = client.post(
        "/api/v1/auth/verify-reset-code",
        json={"email": "wrong-code@example.com", "code": "000000"},
    )

    assert response.status_code == 401


def test_reset_password_with_valid_token(client: TestClient, monkeypatch) -> None:
    """A valid password reset token updates the user's password and clears the code."""
    redis = FakeRedis()
    monkeypatch.setattr(auth_routes, "create_redis_client", lambda: redis)
    register_user(client, "reset-valid@example.com")
    client.post("/api/v1/auth/request-password-reset", json={"email": "reset-valid@example.com"})
    code = redis.values["pwd_reset:reset-valid@example.com"]
    verify_response = client.post(
        "/api/v1/auth/verify-reset-code",
        json={"email": "reset-valid@example.com", "code": code},
    )
    reset_token = verify_response.json()["reset_token"]

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": reset_token, "new_password": "NewStrongPass2"},
    )
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "reset-valid@example.com", "password": "StrongPass1"},
    )
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "reset-valid@example.com", "password": "NewStrongPass2"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "password reset"}
    assert old_login.status_code == 401
    assert new_login.status_code == 200
    assert "pwd_reset:reset-valid@example.com" not in redis.values


def test_reset_password_with_invalid_token_returns_401(client: TestClient) -> None:
    """Invalid password reset tokens are rejected."""
    invalid_reset_token = jwt.encode(
        {
            "sub": str(uuid4()),
            "type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=ALGORITHM,
    )

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": invalid_reset_token, "new_password": "NewStrongPass2"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid reset token"
