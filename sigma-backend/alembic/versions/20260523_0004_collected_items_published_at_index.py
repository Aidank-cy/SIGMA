"""add_collected_items_published_at_index

Revision ID: 20260523_0004
Revises: 20260522_0003
Create Date: 2026-05-23 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260523_0004"
down_revision: str | None = "20260522_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add published time index for item list ordering."""
    op.create_index(
        "ix_collected_items_published_at",
        "collected_items",
        ["published_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove published time index for item list ordering."""
    op.drop_index("ix_collected_items_published_at", table_name="collected_items")
