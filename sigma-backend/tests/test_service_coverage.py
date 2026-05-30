from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collected_item import CollectedItem
from app.models.collector_log import CollectorLog
from app.models.data_source import DataSource
from app.models.enums import (
    CollectorStatus,
    IntelligenceCategory,
    Market,
    ReportType,
    SourceType,
    UserRole,
)
from app.models.user import User
from app.schemas.admin import AdminUserReportConfigUpdate
from app.schemas.source import DataSourceCreate, DataSourceUpdate
from app.services import admin_service, admin_source_service, source_service


@pytest.mark.asyncio
async def test_admin_service_updates_report_config_and_deletes_user(
    db_session: AsyncSession,
) -> None:
    """Admin service updates report settings and removes a managed user."""
    admin = _user("coverage-admin@example.com", UserRole.ADMIN)
    target = _user("coverage-managed@example.com", UserRole.USER)
    db_session.add_all([admin, target])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(target)

    listed = await admin_service.list_admin_users(db_session, 1, 10, "managed")
    updated_user = await admin_service.update_admin_user(
        db_session,
        target.id,
        admin_service.AdminUserUpdate(is_active=False),
        admin.id,
    )
    report_config = await admin_service.update_admin_user_report_config(
        db_session,
        target.id,
        AdminUserReportConfigUpdate(
            categories=[IntelligenceCategory.FINANCE],
            is_active=False,
            markets=[Market.US],
            max_tokens={ReportType.WEEKLY: 3600},
            report_frequencies=[ReportType.WEEKLY],
            report_frequency=ReportType.WEEKLY,
            time_ranges={
                "weekly": {
                    "start_day_offset": 7,
                    "end_day_offset": 0,
                    "start_time": "17:45",
                    "end_time": "17:44",
                    "generation_day_of_week": 4,
                    "generation_time": "18:00",
                }
            },
        ),
    )

    await admin_service.delete_admin_user(db_session, target.id, admin.id)

    assert listed.total == 1
    assert updated_user.is_active is False
    assert report_config.report_frequencies == [ReportType.WEEKLY]
    assert report_config.max_tokens[ReportType.WEEKLY] == 3600


@pytest.mark.asyncio
async def test_admin_source_service_crud_for_managed_user(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Admin source service stages custom source CRUD for another user."""
    admin = _user("source-admin@example.com", UserRole.ADMIN)
    target = _user("source-managed@example.com", UserRole.USER)
    db_session.add_all([admin, target])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(target)
    scheduled: list[UUID] = []
    removed: list[UUID] = []
    monkeypatch.setattr(
        admin_source_service,
        "add_or_update_source_job",
        lambda source: scheduled.append(source.id),
    )
    monkeypatch.setattr(
        admin_source_service,
        "remove_source_job",
        lambda source_id: removed.append(source_id),
    )

    created = await admin_source_service.create_admin_user_source(
        db_session,
        target.id,
        _source_payload("Managed coverage RSS"),
        admin.id,
    )
    listed = await admin_source_service.list_admin_user_sources(
        db_session, target.id, 1, 10, admin.id
    )
    updated = await admin_source_service.update_admin_user_source(
        db_session,
        target.id,
        created.id,
        DataSourceUpdate(is_active=False, name="Managed coverage RSS inactive"),
        admin.id,
    )
    await admin_source_service.delete_admin_user_source(db_session, target.id, created.id, admin.id)

    assert listed.total == 1
    assert updated.is_active is False
    assert scheduled == [created.id]
    assert removed == [created.id, created.id]


@pytest.mark.asyncio
async def test_source_service_lifecycle_and_error_edges(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Source service handles preview, status, inactive collect, and deletion."""
    user = _user("source-owner@example.com", UserRole.USER)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    scheduled: list[UUID] = []
    removed: list[UUID] = []
    monkeypatch.setattr(
        source_service,
        "add_or_update_source_job",
        lambda source: scheduled.append(source.id),
    )
    monkeypatch.setattr(
        source_service,
        "remove_source_job",
        lambda source_id: removed.append(source_id),
    )

    created = await source_service.create_source(
        db_session, _source_payload("Owner coverage RSS"), user
    )
    source = await db_session.get(DataSource, created.id)
    assert source is not None
    log = CollectorLog(
        source_id=created.id,
        status=CollectorStatus.SUCCESS,
        items_count=2,
        duration_ms=12,
        executed_at=datetime.now(UTC),
    )
    item = CollectedItem(
        source_id=created.id,
        title="Coverage item",
        content_raw="Coverage content",
        content_url="https://coverage.test/item",
        category=IntelligenceCategory.FINANCE,
        market=Market.US,
        published_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    db_session.add_all([log, item])
    await db_session.commit()

    preview = await source_service.test_source(
        db_session,
        created.id,
        user,
        lambda _source: FakeCollector(),
    )
    status = await source_service.get_source_status(db_session, created.id, user)
    inactive = await source_service.update_source(
        db_session,
        created.id,
        DataSourceUpdate(is_active=False),
        user,
    )

    async def collect_job(_source_id: UUID) -> None:
        return None

    with pytest.raises(HTTPException) as exc_info:
        await source_service.collect_source(
            db_session,
            created.id,
            user,
            collect_job,
            lambda coro: coro,
            set(),
        )
    await source_service.delete_source(db_session, created.id, user)

    assert preview.items == [{"title": "Preview", "content": "Text"}]
    assert status.last_status == "success"
    assert inactive.is_active is False
    assert exc_info.value.status_code == 400
    assert scheduled == [created.id]
    assert removed == [created.id, created.id]


class FakeCollector:
    """Collector double for service preview tests."""

    async def collect(self) -> list[dict[str, str]]:
        """Return a single preview item."""
        return [{"title": "Preview", "content": "Text"}]


def _user(email: str, role: UserRole) -> User:
    return User(
        email=email,
        hashed_password="hashed",
        display_name=email.split("@")[0],
        role=role,
        is_active=True,
    )


def _source_payload(name: str) -> DataSourceCreate:
    return DataSourceCreate(
        category=IntelligenceCategory.FINANCE,
        config={"feed_url": f"https://{uuid4()}.test/feed.xml"},
        is_active=True,
        market=Market.US,
        max_execution_seconds=60,
        name=name,
        schedule_cron="0 * * * *",
        source_type=SourceType.RSS,
    )
