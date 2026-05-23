from uuid import uuid4

import pytest

from app.utils import event_hooks


@pytest.mark.asyncio
async def test_notify_new_items_deletes_item_cache_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    """New item notifications clear cached item list responses."""
    redis = FakeRedis()

    monkeypatch.setattr(event_hooks, "create_redis_client", lambda: redis)

    await event_hooks.notify_new_items([uuid4()])

    assert redis.scan_calls == [
        (0, "sigma:items:*", 200),
        (1, "sigma:items:*", 200),
    ]
    assert redis.deleted == [b"sigma:items:all", b"sigma:items:finance"]
    assert redis.closed is True


@pytest.mark.asyncio
async def test_notify_new_items_skips_empty_batches(monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty item batches do not touch Redis."""

    def fail_create_client() -> FakeRedis:
        raise AssertionError("Redis should not be created for an empty item batch")

    monkeypatch.setattr(event_hooks, "create_redis_client", fail_create_client)

    await event_hooks.notify_new_items([])


class FakeRedis:
    def __init__(self) -> None:
        self.closed = False
        self.deleted: list[bytes] = []
        self.scan_calls: list[tuple[int | bytes | str, str, int]] = []

    async def scan(
        self,
        cursor: int | bytes | str = 0,
        match: str | None = None,
        count: int | None = None,
    ) -> tuple[int, list[bytes]]:
        self.scan_calls.append((cursor, str(match), int(count or 0)))
        if cursor == 0:
            return 1, [b"sigma:items:all"]
        return 0, [b"sigma:items:finance"]

    async def delete(self, *keys: bytes) -> None:
        self.deleted.extend(keys)

    async def aclose(self) -> None:
        self.closed = True
