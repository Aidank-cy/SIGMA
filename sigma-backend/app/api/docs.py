from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute

from app.core.config import settings

OPENAPI_TAGS = [
    {"name": "Auth", "description": "Registration, login, refresh, and current-user identity."},
    {"name": "Items", "description": "Collected intelligence item feeds and details."},
    {"name": "Sources", "description": "User-visible data source management and source testing."},
    {"name": "Watchlists", "description": "Per-user watchlists and filtered intelligence feeds."},
    {
        "name": "Reports",
        "description": "Generated intelligence reports and manual report generation.",
    },
    {
        "name": "UserSettings",
        "description": "Profile, retention, password, and report preferences.",
    },
    {"name": "Admin/Dashboard", "description": "Admin dashboard statistics and health telemetry."},
    {"name": "Admin/Users", "description": "Admin user search, role management, and deactivation."},
    {
        "name": "Admin/Sources",
        "description": "Admin source creation, preview, logs, and lifecycle controls.",
    },
    {
        "name": "Admin/LLM",
        "description": "Admin LLM provider, model, cost guard, and usage controls.",
    },
    {"name": "Admin/Logs", "description": "Admin collector log search and success-rate reporting."},
    {"name": "Health", "description": "Service health checks."},
]


def install_openapi_schema(app: FastAPI) -> None:
    """Install polished OpenAPI generation for interactive docs."""

    for route in app.routes:
        if isinstance(route, APIRoute):
            route.description = route.description or _route_description(route)
            route.summary = route.summary or _route_summary(route)

    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=settings.app_name,
            version=settings.app_version,
            description=(
                "SIGMA stock intelligence API for frontend and external system consumption."
            ),
            routes=app.routes,
            tags=OPENAPI_TAGS,
        )
        _enrich_schema_components(schema)
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi


def _route_description(route: APIRoute) -> str:
    endpoint_doc = (route.endpoint.__doc__ or "").strip()
    return endpoint_doc or f"{route.name.replace('_', ' ').title()} endpoint."


def _route_summary(route: APIRoute) -> str:
    return route.name.replace("_", " ").title()


def _enrich_schema_components(schema: dict[str, Any]) -> None:
    components = schema.get("components", {}).get("schemas", {})
    if not isinstance(components, dict):
        return
    for schema_name, component in components.items():
        if not isinstance(component, dict):
            continue
        component.setdefault("description", f"{schema_name} payload.")
        properties = component.get("properties", {})
        if not isinstance(properties, dict):
            continue
        for property_name, property_schema in properties.items():
            if not isinstance(property_schema, dict):
                continue
            label = property_name.replace("_", " ")
            property_schema.setdefault("description", f"{label.title()} field.")
            property_schema.setdefault("example", _example_for(property_name, property_schema))


def _example_for(property_name: str, property_schema: dict[str, Any]) -> Any:
    if property_name.endswith("_at") or property_name in {"period_start", "period_end"}:
        return "2026-05-16T00:00:00Z"
    if property_name.endswith("_id") or property_name == "id":
        return "00000000-0000-0000-0000-000000000000"
    if "email" in property_name:
        return "user@example.com"
    schema_type = property_schema.get("type")
    if schema_type == "integer":
        return 1
    if schema_type == "number":
        return 1.0
    if schema_type == "boolean":
        return True
    if schema_type == "array":
        return []
    if schema_type == "object":
        return {}
    return property_name.replace("_", " ")
