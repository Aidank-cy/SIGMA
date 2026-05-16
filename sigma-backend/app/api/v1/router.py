from fastapi import APIRouter

from app.api.v1.admin.dashboard import router as admin_dashboard_router
from app.api.v1.admin.llm import router as admin_llm_router
from app.api.v1.admin.logs import router as admin_logs_router
from app.api.v1.admin.sources import router as admin_sources_router
from app.api.v1.admin.users import router as admin_users_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.items import router as items_router
from app.api.v1.routes.reports import router as reports_router
from app.api.v1.routes.sources import router as sources_router
from app.api.v1.routes.user_settings import router as user_settings_router
from app.api.v1.routes.watchlists import router as watchlists_router

api_router = APIRouter()
api_router.include_router(admin_dashboard_router, prefix="/admin/dashboard", tags=["admin-dashboard"])
api_router.include_router(admin_llm_router, prefix="/admin/llm", tags=["admin-llm"])
api_router.include_router(admin_logs_router, prefix="/admin/logs", tags=["admin-logs"])
api_router.include_router(admin_sources_router, prefix="/admin", tags=["admin-sources"])
api_router.include_router(admin_users_router, prefix="/admin/users", tags=["admin-users"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(items_router, prefix="/items", tags=["items"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
api_router.include_router(sources_router, prefix="/sources", tags=["sources"])
api_router.include_router(user_settings_router, prefix="/me", tags=["user-settings"])
api_router.include_router(watchlists_router, prefix="/watchlists", tags=["watchlists"])
