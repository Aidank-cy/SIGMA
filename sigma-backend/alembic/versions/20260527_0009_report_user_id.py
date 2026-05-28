"""Add user ownership to reports.

Revision ID: 20260527_0009
Revises: 20260525_0008
Create Date: 2026-05-27
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260527_0009"
down_revision: str | None = "20260525_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.add_column("reports", sa.Column("user_id", sa.Uuid(), nullable=True))
        op.create_foreign_key(
            "fk_reports_user_id_users",
            "reports",
            "users",
            ["user_id"],
            ["id"],
        )
    else:
        with op.batch_alter_table("reports") as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.Uuid(), nullable=True))
            batch_op.create_foreign_key(
                "fk_reports_user_id_users",
                "users",
                ["user_id"],
                ["id"],
            )
    op.create_index("ix_reports_user_id", "reports", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_reports_user_id", table_name="reports")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint("fk_reports_user_id_users", "reports", type_="foreignkey")
        op.drop_column("reports", "user_id")
        return

    with op.batch_alter_table("reports") as batch_op:
        batch_op.drop_constraint("fk_reports_user_id_users", type_="foreignkey")
        batch_op.drop_column("user_id")
