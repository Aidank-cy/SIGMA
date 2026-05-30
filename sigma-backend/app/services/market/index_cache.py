"""Market index Redis cache helpers."""

import json
from datetime import datetime, timedelta
from typing import Any

from app.schemas.market import MarketIndicesResponse
from app.services.market.clock import any_market_trading_now
from app.services.market.config import (
    ACTIVE_CACHE_TTL_SECONDS,
    CACHE_KEY,
    CLOSED_CACHE_TTL_SECONDS,
    STALE_CACHE_TTL_SECONDS,
)
from app.utils.redis_lock import create_redis_client


def _market_cache_ttl_seconds(now: datetime | None = None) -> int:
    return ACTIVE_CACHE_TTL_SECONDS if any_market_trading_now(now) else CLOSED_CACHE_TTL_SECONDS


def _market_cache_expiration_seconds(now: datetime | None = None) -> int:
    return max(_market_cache_ttl_seconds(now), STALE_CACHE_TTL_SECONDS)


def _cached_payload_is_fresh(value: str, now: datetime | None = None) -> bool:
    from app.services.market import indices

    try:
        response = MarketIndicesResponse.model_validate_json(value)
    except Exception:
        return False
    current = now or indices._now_utc()
    age = current - response.updated_at
    return age <= timedelta(seconds=indices._market_cache_ttl_seconds(current))


async def _cache_get() -> str | None:
    client = create_redis_client()
    try:
        cached = await client.get(CACHE_KEY)
    except Exception:
        return None
    finally:
        await client.aclose()
    return str(cached) if cached else None


async def _cache_set(value: str) -> None:
    from app.services.market import indices

    client = create_redis_client()
    try:
        await client.set(CACHE_KEY, value, ex=indices._market_cache_expiration_seconds())
    except Exception:
        return
    finally:
        await client.aclose()


def decode_cached_payload(value: str) -> dict[str, Any]:
    """Decode a cached payload for focused unit tests."""
    return json.loads(value)
