from fastapi import APIRouter

from app.api.v1.admin.dashboard import router as admin_dashboard_router
from app.api.v1.admin.llm import router as admin_llm_router
from app.api.v1.admin.logs import router as admin_logs_router
from app.api.v1.admin.users import router as admin_users_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.items import router as items_router
from app.api.v1.routes.market_indices import router as market_indices_router
from app.api.v1.routes.reports import router as reports_router
from app.api.v1.routes.sources import router as sources_router
from app.api.v1.routes.stats import router as stats_router
from app.api.v1.routes.user_settings import router as user_settings_router
from app.api.v1.routes.watchlists import router as watchlists_router

api_router = APIRouter()
api_router.include_router(admin_dashboard_router, prefix="/admin/dashboard", tags=["Admin/Dashboard"])
api_router.include_router(admin_llm_router, prefix="/admin/llm", tags=["Admin/LLM"])
api_router.include_router(admin_logs_router, prefix="/admin/logs", tags=["Admin/Logs"])
api_router.include_router(admin_users_router, prefix="/admin/users", tags=["Admin/Users"])
api_router.include_router(auth_router, tags=["Auth"])
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(items_router, prefix="/items", tags=["Items"])
api_router.include_router(market_indices_router, prefix="/market-indices", tags=["MarketIndices"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_router.include_router(sources_router, prefix="/sources", tags=["Sources"])
api_router.include_router(stats_router, prefix="/stats", tags=["Stats"])
api_router.include_router(user_settings_router, prefix="/me", tags=["UserSettings"])
api_router.include_router(watchlists_router, prefix="/watchlists", tags=["Watchlists"])
