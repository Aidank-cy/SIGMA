from app.utils.redis_lock import acquire_lock, release_lock


class FakeRedis:
    """Small async Redis stand-in for lock tests."""

    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    async def set(self, key: str, value: str, ex: int, nx: bool) -> bool:
        if nx and key in self.values:
            return False
        self.values[key] = value
        assert ex > 0
        return True

    async def delete(self, key: str) -> int:
        self.values.pop(key, None)
        return 1


async def test_redis_lock_acquire_and_release() -> None:
    """Redis lock helper uses NX set and delete."""
    redis = FakeRedis()

    assert await acquire_lock("collector:lock:test", 10, redis) is True
    assert await acquire_lock("collector:lock:test", 10, redis) is False
    await release_lock("collector:lock:test", redis)
    assert await acquire_lock("collector:lock:test", 10, redis) is True
