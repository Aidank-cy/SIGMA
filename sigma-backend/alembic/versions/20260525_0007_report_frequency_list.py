"""Add multi-select report frequencies.

Revision ID: 20260525_0007
Revises: 20260525_0006
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260525_0007"
down_revision: str | None = "20260525_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.add_column(
            "user_report_configs",
            sa.Column(
                "report_frequencies",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'[\"daily\"]'::jsonb"),
                nullable=False,
            ),
        )
        op.execute(
            "UPDATE user_report_configs "
            "SET report_frequencies = jsonb_build_array(report_frequency::text)"
        )
        op.alter_column("user_report_configs", "report_frequencies", server_default=None)
        return

    op.add_column(
        "user_report_configs",
        sa.Column("report_frequencies", sa.JSON(), server_default='["daily"]', nullable=False),
    )
    op.execute("UPDATE user_report_configs SET report_frequencies = json_array(report_frequency)")
    with op.batch_alter_table("user_report_configs") as batch_op:
        batch_op.alter_column("report_frequencies", server_default=None)


def downgrade() -> None:
    op.drop_column("user_report_configs", "report_frequencies")
