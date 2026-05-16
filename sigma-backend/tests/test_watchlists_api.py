from fastapi.testclient import TestClient


def test_watchlist_crud_and_items(client: TestClient) -> None:
    """Users can manage watchlists and read their filtered feed."""
    token = _token(client, "watchlist-user@example.com")
    headers = _auth(token)

    create_response = client.post(
        "/api/v1/watchlists",
        headers=headers,
        json={"name": "US macro", "keywords": ["rates"], "sources": [], "markets": ["us"]},
    )
    assert create_response.status_code == 201
    watchlist = create_response.json()

    list_response = client.get("/api/v1/watchlists", headers=headers)
    items_response = client.get(f"/api/v1/watchlists/{watchlist['id']}/items", headers=headers)
    update_response = client.put(
        f"/api/v1/watchlists/{watchlist['id']}",
        headers=headers,
        json={"name": "Global macro", "keywords": ["inflation"], "sources": [], "markets": ["global"]},
    )
    delete_response = client.delete(f"/api/v1/watchlists/{watchlist['id']}", headers=headers)

    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["name"] == "US macro"
    assert items_response.status_code == 200
    assert items_response.json()["total"] == 0
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Global macro"
    assert delete_response.status_code == 204


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
