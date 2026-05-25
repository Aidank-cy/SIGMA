"""Add precise report windows and user-scoped LLM usage.

Revision ID: 20260525_0006
Revises: 20260524_0005
Create Date: 2026-05-25
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260525_0006"
down_revision: str | None = "20260524_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'daily_morning'")
        op.execute("ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'daily_afternoon'")
        op.alter_column(
            "reports",
            "period_start",
            existing_type=sa.Date(),
            type_=sa.DateTime(timezone=True),
            postgresql_using="period_start::timestamp with time zone",
            nullable=False,
        )
        op.alter_column(
            "reports",
            "period_end",
            existing_type=sa.Date(),
            type_=sa.DateTime(timezone=True),
            postgresql_using="period_end::timestamp with time zone",
            nullable=False,
        )
    else:
        with op.batch_alter_table("reports") as batch_op:
            batch_op.alter_column(
                "period_start",
                existing_type=sa.Date(),
                type_=sa.DateTime(timezone=True),
                nullable=False,
            )
            batch_op.alter_column(
                "period_end",
                existing_type=sa.Date(),
                type_=sa.DateTime(timezone=True),
                nullable=False,
            )

    if bind.dialect.name == "postgresql":
        op.add_column("llm_usage_logs", sa.Column("user_id", sa.Uuid(), nullable=True))
        op.create_foreign_key(
            "fk_llm_usage_logs_user_id_users",
            "llm_usage_logs",
            "users",
            ["user_id"],
            ["id"],
        )
    else:
        with op.batch_alter_table("llm_usage_logs") as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.Uuid(), nullable=True))
            batch_op.create_foreign_key(
                "fk_llm_usage_logs_user_id_users",
                "users",
                ["user_id"],
                ["id"],
            )
    op.create_index("ix_llm_usage_logs_user_id_created_at", "llm_usage_logs", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_llm_usage_logs_user_id_created_at", table_name="llm_usage_logs")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint("fk_llm_usage_logs_user_id_users", "llm_usage_logs", type_="foreignkey")
        op.drop_column("llm_usage_logs", "user_id")
    else:
        with op.batch_alter_table("llm_usage_logs") as batch_op:
            batch_op.drop_constraint("fk_llm_usage_logs_user_id_users", type_="foreignkey")
            batch_op.drop_column("user_id")

    if bind.dialect.name == "postgresql":
        op.alter_column(
            "reports",
            "period_end",
            existing_type=postgresql.TIMESTAMP(timezone=True),
            type_=sa.Date(),
            postgresql_using="period_end::date",
            nullable=False,
        )
        op.alter_column(
            "reports",
            "period_start",
            existing_type=postgresql.TIMESTAMP(timezone=True),
            type_=sa.Date(),
            postgresql_using="period_start::date",
            nullable=False,
        )
    else:
        with op.batch_alter_table("reports") as batch_op:
            batch_op.alter_column(
                "period_end",
                existing_type=sa.DateTime(timezone=True),
                type_=sa.Date(),
                nullable=False,
            )
            batch_op.alter_column(
                "period_start",
                existing_type=sa.DateTime(timezone=True),
                type_=sa.Date(),
                nullable=False,
            )
