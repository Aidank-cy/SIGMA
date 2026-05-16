from app.scheduler.hooks import notify_new_items, notify_new_report


async def run_collection_job() -> None:
    """Run a placeholder collection job."""
    item_ids: list[str] = []
    await notify_new_items(item_ids)


async def run_report_job() -> None:
    """Run a placeholder report job."""
    report_id = ""
    await notify_new_report(report_id)
