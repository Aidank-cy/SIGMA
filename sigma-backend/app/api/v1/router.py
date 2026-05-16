from fastapi import APIRouter

from app.api.v1.admin.sources import router as admin_sources_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.items import router as items_router
from app.api.v1.routes.sources import router as sources_router

api_router = APIRouter()
api_router.include_router(admin_sources_router, prefix="/admin", tags=["admin-sources"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(items_router, prefix="/items", tags=["items"])
api_router.include_router(sources_router, prefix="/sources", tags=["sources"])
