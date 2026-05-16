from fastapi.testclient import TestClient

from app.api.v1.routes import auth as auth_routes


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
    payload = register_user(client, "admin@example.com")

    assert payload["email"] == "admin@example.com"
    assert payload["role"] == "admin"
    assert "hashed_password" not in payload


def test_register_second_is_user(client: TestClient) -> None:
    """Subsequent registered users receive user role."""
    register_user(client, "admin@example.com")
    payload = register_user(client, "user@example.com")

    assert payload["role"] == "user"


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


def test_login_wrong_password_401(client: TestClient) -> None:
    """Invalid credentials are rejected."""
    register_user(client, "user@example.com")

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "WrongPass1"},
    )

    assert response.status_code == 401


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
