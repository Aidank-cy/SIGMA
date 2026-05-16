from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.docs import OPENAPI_TAGS, install_openapi_schema
from app.api.v1.router import api_router
from app.collectors.seeds import seed_data_sources
from app.core.config import settings
from app.database import AsyncSessionLocal
from app.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware
from app.scheduler.engine import start_scheduler, stop_scheduler


def create_app(enable_scheduler: bool = True) -> FastAPI:
    """Create and configure the FastAPI application."""
    _validate_security_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="SIGMA stock intelligence API for frontend and machine consumers.",
        openapi_tags=OPENAPI_TAGS,
        lifespan=_lifespan if enable_scheduler else None,
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(api_router, prefix="/api/v1")
    install_openapi_schema(app)
    return app


def _validate_security_settings() -> None:
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters")


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    async with AsyncSessionLocal() as db:
        await seed_data_sources(db)
    await start_scheduler()
    try:
        yield
    finally:
        await stop_scheduler()


app = create_app()
