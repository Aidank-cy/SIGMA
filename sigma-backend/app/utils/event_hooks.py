from uuid import UUID


async def notify_new_items(item_ids: list[UUID]) -> None:
    """Extension hook for downstream systems interested in new items."""
    pass


async def notify_new_report(report_id: UUID) -> None:
    """Extension hook for downstream systems interested in new reports."""
    pass
