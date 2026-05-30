"""Add report time ranges.

Revision ID: 20260525_0008
Revises: 20260525_0007
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260525_0008"
down_revision: str | None = "20260525_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.add_column(
            "user_report_configs",
            sa.Column(
                "time_ranges",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
        )
        op.alter_column("user_report_configs", "time_ranges", server_default=None)
        return

    op.add_column(
        "user_report_configs",
        sa.Column("time_ranges", sa.JSON(), server_default="{}", nullable=False),
    )
    with op.batch_alter_table("user_report_configs") as batch_op:
        batch_op.alter_column("time_ranges", server_default=None)


def downgrade() -> None:
    op.drop_column("user_report_configs", "time_ranges")
