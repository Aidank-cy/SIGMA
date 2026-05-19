from app.utils.redis_lock import acquire_lock, release_lock


class FakeRedis:
    """Small async Redis stand-in for lock tests."""

    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.expirations: dict[str, int] = {}
        self.now = 0

    async def set(self, key: str, value: str, ex: int, nx: bool) -> bool:
        self._expire_stale_keys()
        if nx and key in self.values:
            return False
        self.values[key] = value
        self.expirations[key] = self.now + ex
        assert ex > 0
        return True

    async def delete(self, key: str) -> int:
        self.values.pop(key, None)
        self.expirations.pop(key, None)
        return 1

    def advance(self, seconds: int) -> None:
        self.now += seconds
        self._expire_stale_keys()

    def _expire_stale_keys(self) -> None:
        for key, expires_at in list(self.expirations.items()):
            if expires_at <= self.now:
                self.values.pop(key, None)
                self.expirations.pop(key, None)


async def test_redis_lock_prevents_concurrent_same_source() -> None:
    """Redis lock helper uses NX set to block the same key."""
    redis = FakeRedis()

    assert await acquire_lock("collector:lock:test", 10, redis) is True
    assert await acquire_lock("collector:lock:test", 10, redis) is False
    await release_lock("collector:lock:test", redis)
    assert await acquire_lock("collector:lock:test", 10, redis) is True


async def test_redis_lock_auto_releases_after_ttl() -> None:
    """Redis lock helper passes the TTL so stale locks expire."""
    redis = FakeRedis()

    assert await acquire_lock("collector:lock:test", 10, redis) is True
    redis.advance(9)
    assert await acquire_lock("collector:lock:test", 10, redis) is False
    redis.advance(1)
    assert await acquire_lock("collector:lock:test", 10, redis) is True


async def test_redis_lock_allows_different_sources_in_parallel() -> None:
    """Different source IDs use different lock keys."""
    redis = FakeRedis()

    assert await acquire_lock("collector:lock:source-a", 10, redis) is True
    assert await acquire_lock("collector:lock:source-b", 10, redis) is True
