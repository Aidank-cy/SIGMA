from fastapi.testclient import TestClient

from app.main import create_app


def test_health_endpoint() -> None:
    """Health endpoint returns service status."""
    client = TestClient(create_app())

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "sigma-backend"}


def test_openapi_docs_are_polished() -> None:
    """OpenAPI docs include route and schema metadata."""
    client = TestClient(create_app(enable_scheduler=False))

    docs_response = client.get("/docs")
    schema_response = client.get("/openapi.json")

    assert docs_response.status_code == 200
    schema = schema_response.json()
    assert schema_response.status_code == 200
    assert {"Auth", "Items", "Sources", "Reports", "UserSettings", "Admin/Users"}.issubset(
        {tag["name"] for tag in schema["tags"]}
    )
    for path_item in schema["paths"].values():
        for operation in path_item.values():
            assert operation["summary"]
            assert operation["description"]
    for component in schema["components"]["schemas"].values():
        assert component["description"]
        for property_schema in component.get("properties", {}).values():
            assert property_schema["description"]
            assert "example" in property_schema
