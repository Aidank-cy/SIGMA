from collections.abc import Awaitable, Callable

from redis.asyncio import Redis

from app.core.config import settings

RedisCommand = Callable[..., Awaitable[object]]


def create_redis_client() -> Redis:
    """Create a Redis client from application settings."""
    return Redis.from_url(settings.redis_url, decode_responses=True)


async def acquire_lock(key: str, ttl: int, redis_client: Redis | None = None) -> bool:
    """Acquire a Redis lock with an expiration TTL."""
    client = redis_client or create_redis_client()
    result = await client.set(key, "locked", ex=ttl, nx=True)
    if redis_client is None:
        await client.aclose()
    return bool(result)


async def release_lock(key: str, redis_client: Redis | None = None) -> None:
    """Release a Redis lock."""
    client = redis_client or create_redis_client()
    await client.delete(key)
    if redis_client is None:
        await client.aclose()
