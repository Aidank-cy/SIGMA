from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import api_router
from app.collectors.seeds import seed_data_sources
from app.core.config import settings
from app.database import AsyncSessionLocal
from app.scheduler.engine import start_scheduler, stop_scheduler


def create_app(enable_scheduler: bool = True) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=_lifespan if enable_scheduler else None,
    )
    app.include_router(api_router, prefix="/api/v1")
    return app


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
