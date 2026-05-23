import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.models.collected_item import CollectedItem
from app.models.data_source import DataSource
from app.models.enums import IntelligenceCategory, Market, SourceType


def test_items_http_list_pagination_filters_formats_and_detail(client: TestClient) -> None:
    """Items endpoints expose paginated, filterable, machine-consumable HTTP responses."""
    seeded = _seed_items(client)
    first_page = client.get("/api/v1/items")

    assert first_page.status_code == 200
    first_payload = first_page.json()
    assert first_payload["page"] == 1
    assert first_payload["page_size"] == 20
    assert first_payload["total"] == 8
    assert first_payload["has_next"] is False
    assert isinstance(first_payload["items"], list)
    assert first_payload["items"][0]["title"] == "AI stock rally"

    page_one = client.get("/api/v1/items?page=1&page_size=5").json()
    page_two = client.get("/api/v1/items?page=2&page_size=5").json()
    assert page_one["total"] == 8
    assert page_one["has_next"] is True
    assert page_two["page"] == 2
    assert {item["id"] for item in page_one["items"]}.isdisjoint({item["id"] for item in page_two["items"]})

    finance = client.get("/api/v1/items?category=finance").json()
    assert finance["total"] == 5
    assert {item["category"] for item in finance["items"]} == {"finance"}

    us_market = client.get("/api/v1/items?market=us").json()
    assert {item["market"] for item in us_market["items"]} == {"us"}

    source_filtered = client.get(f"/api/v1/items?source_id={seeded['source_us']}").json()
    assert source_filtered["total"] == 5
    assert {item["source_id"] for item in source_filtered["items"]} == {seeded["source_us"]}

    date_from = seeded["base"].isoformat()
    from_filtered = client.get("/api/v1/items", params={"date_from": date_from}).json()
    assert all(_parse_dt(item["published_at"]) >= seeded["base"] for item in from_filtered["items"])

    date_to = (seeded["base"] - timedelta(days=2)).isoformat()
    to_filtered = client.get("/api/v1/items", params={"date_to": date_to}).json()
    assert all(_parse_dt(item["published_at"]) <= seeded["base"] - timedelta(days=2) for item in to_filtered["items"])

    range_to = (seeded["base"] - timedelta(days=1)).isoformat()
    range_filtered = client.get("/api/v1/items", params={"date_from": date_to, "date_to": range_to}).json()
    assert {item["title"] for item in range_filtered["items"]} == {"China AI policy", "Bank stock earnings"}

    since_filtered = client.get("/api/v1/items", params={"since": (seeded["base"] - timedelta(days=3)).isoformat()}).json()
    assert {item["title"] for item in since_filtered["items"]} == {
        "AI stock rally",
        "China AI policy",
        "Bank stock earnings",
        "Macro inflation risk",
    }

    keyword = client.get("/api/v1/items?keyword=AI").json()
    assert keyword["total"] == 2
    assert {item["title"] for item in keyword["items"]} == {"AI stock rally", "China AI policy"}

    combined = client.get("/api/v1/items?category=finance&market=us&keyword=stock").json()
    assert {item["title"] for item in combined["items"]} == {"AI stock rally", "Bank stock earnings"}

    multi_category = client.get("/api/v1/items?category=finance,technology").json()
    assert multi_category["total"] == 7
    assert {item["category"] for item in multi_category["items"]} == {"finance", "technology"}

    multi_market = client.get("/api/v1/items?market=us,cn").json()
    assert multi_market["total"] == 8
    assert {item["market"] for item in multi_market["items"]} == {"us", "cn"}

    minimal = client.get("/api/v1/items?format=minimal").json()
    assert "source_name" not in minimal["items"][0]
    assert "content_url" not in minimal["items"][0]

    full = client.get("/api/v1/items?format=full").json()
    assert "source_name" in full["items"][0]
    assert "content_url" in full["items"][0]

    detail = client.get(f"/api/v1/items/{seeded['target_item']}").json()
    assert detail["title"] == "AI stock rally"
    assert detail["sentiment"] == "bullish"
    assert detail["keywords"] == ["ai", "stocks"]
    assert detail["related"]
    assert all(item["category"] == "finance" and item["market"] == "us" for item in detail["related"])

    missing = client.get(f"/api/v1/items/{uuid4()}")
    assert missing.status_code == 404

    published_at_values = [_parse_dt(item["published_at"]) for item in full["items"]]
    assert published_at_values == sorted(published_at_values, reverse=True)

    empty = client.get("/api/v1/items?category=finance&market=us&keyword=xyznonexistent").json()
    assert empty["total"] == 0
    assert empty["items"] == []

    assert client.get("/api/v1/items?page=0").status_code == 422
    assert client.get("/api/v1/items?page_size=501").status_code == 422


def _seed_items(client: TestClient) -> dict[str, object]:
    return asyncio.run(_seed_items_async(client))


async def _seed_items_async(client: TestClient) -> dict[str, object]:
    session_factory = client.app.state.session_factory
    base = datetime(2026, 1, 10, 12, 0, tzinfo=UTC)
    source_us = _source("Items US Source", IntelligenceCategory.FINANCE, Market.US)
    source_cn = _source("Items CN Source", IntelligenceCategory.TECHNOLOGY, Market.CN)

    items = [
        _item(source_us, "AI stock rally", IntelligenceCategory.FINANCE, Market.US, base, 8, "AI stock rally content"),
        _item(source_cn, "China AI policy", IntelligenceCategory.TECHNOLOGY, Market.CN, base - timedelta(days=1), 7, "AI policy content"),
        _item(source_us, "Bank stock earnings", IntelligenceCategory.FINANCE, Market.US, base - timedelta(days=2), 6, "Bank stock content"),
        _item(source_us, "Macro inflation risk", IntelligenceCategory.MACRO, Market.US, base - timedelta(days=3), 5, "Inflation content"),
        _item(source_cn, "Consumer finance update", IntelligenceCategory.FINANCE, Market.CN, base - timedelta(days=4), 4, "Consumer finance"),
        _item(source_us, "Energy credit outlook", IntelligenceCategory.FINANCE, Market.US, base - timedelta(days=5), 3, "Energy credit"),
        _item(source_cn, "Chip export rules", IntelligenceCategory.TECHNOLOGY, Market.CN, base - timedelta(days=6), 2, "Chip exports"),
        _item(source_us, "Dividend desk note", IntelligenceCategory.FINANCE, Market.US, base - timedelta(days=7), 1, "Dividend note"),
    ]
    items[0].summary = '{"summary":"AI stock rally summary","sentiment":"bullish","keywords":["ai","stocks"]}'
    items[-1].collected_at = base + timedelta(hours=1)

    async with session_factory() as db:
        db.add_all([source_us, source_cn, *items])
        await db.commit()
        for item in items:
            await db.refresh(item)

    return {"base": base, "source_us": str(source_us.id), "source_cn": str(source_cn.id), "target_item": str(items[0].id)}


def _source(name: str, category: IntelligenceCategory, market: Market) -> DataSource:
    return DataSource(
        id=uuid4(),
        name=name,
        source_type=SourceType.RSS,
        category=category,
        market=market,
        config={"feed_url": f"https://items-http.test/{uuid4()}.xml"},
        schedule_cron="*/5 * * * *",
        max_execution_seconds=60,
    )


def _item(
    source: DataSource,
    title: str,
    category: IntelligenceCategory,
    market: Market,
    published_at: datetime,
    collected_offset: int,
    content: str,
) -> CollectedItem:
    return CollectedItem(
        source_id=source.id,
        title=title,
        content_raw=content,
        content_url=f"https://items-http.test/{uuid4()}",
        summary=f"{title} summary",
        category=category,
        market=market,
        published_at=published_at,
        collected_at=published_at + timedelta(minutes=collected_offset),
        expires_at=published_at + timedelta(days=30),
    )


def _parse_dt(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
