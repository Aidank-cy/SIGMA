import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole
from app.models.user import User
from scripts.clean_database import _users_to_keep


@pytest.mark.asyncio
async def test_users_to_keep_preserves_admin_without_admin_name(db_session: AsyncSession) -> None:
    """Cleanup keeps admin-role users regardless of email or display name text."""
    admin = User(
        email="john@example.com",
        hashed_password="hashed",
        display_name="John",
        role=UserRole.ADMIN,
    )
    regular = User(
        email="admin-looking@example.com",
        hashed_password="hashed",
        display_name="Admin Looking",
        role=UserRole.USER,
    )
    db_session.add_all([admin, regular])
    await db_session.commit()

    keep_user_ids = await _users_to_keep(db_session)

    assert admin.id in keep_user_ids
    assert regular.id not in keep_user_ids
