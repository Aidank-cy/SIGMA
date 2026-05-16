from fastapi.testclient import TestClient


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
