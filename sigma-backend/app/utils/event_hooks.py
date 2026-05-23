from uuid import UUID

from app.utils.redis_lock import create_redis_client


async def notify_new_items(item_ids: list[UUID]) -> None:
    """Extension hook for downstream systems interested in new items."""
    if not item_ids:
        return

    client = create_redis_client()
    try:
        cursor: int | bytes | str = 0
        while True:
            cursor, keys = await client.scan(cursor=cursor, match="sigma:items:*", count=200)
            if keys:
                await client.delete(*keys)
            if cursor in (0, b"0", "0"):
                break
    except Exception:
        return
    finally:
        await client.aclose()


async def notify_new_report(report_id: UUID) -> None:
    """Extension hook for downstream systems interested in new reports."""
    pass
