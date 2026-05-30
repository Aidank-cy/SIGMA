"""initial_schema

Revision ID: 20260516_0001
Revises:
Create Date: 2026-05-16 03:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260516_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Apply initial SIGMA schema."""
    user_role = sa.Enum("admin", "user", name="user_role")
    user_locale = sa.Enum("zh", "en", name="user_locale")
    source_type = sa.Enum("api", "rss", "scraper", name="source_type")
    category = sa.Enum(
        "politics", "finance", "technology", "macro", "other", name="intelligence_category"
    )
    market = sa.Enum("us", "cn", "jp", "eu", "hk", "global", name="market")
    report_type = sa.Enum("daily", "weekly", "monthly", name="report_type")
    collector_status = sa.Enum("success", "fail", "timeout", name="collector_status")
    llm_function_type = sa.Enum("summary", "report", name="llm_function_type")

    op.create_table(
        "users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("locale", user_locale, nullable=False),
        sa.Column("data_retention_days", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "data_sources",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("source_type", source_type, nullable=False),
        sa.Column("category", category, nullable=False),
        sa.Column("market", market, nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("schedule_cron", sa.String(length=120), nullable=False),
        sa.Column("max_execution_seconds", sa.Integer(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "reports",
        sa.Column("report_type", report_type, nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("market_scope", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("category_scope", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("item_count", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "system_configs",
        sa.Column("key", sa.String(length=180), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    op.create_table(
        "llm_usage_logs",
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=160), nullable=False),
        sa.Column("function_type", llm_function_type, nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "collected_items",
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content_raw", sa.Text(), nullable=False),
        sa.Column("content_url", sa.String(length=1000), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("category", category, nullable=False),
        sa.Column("market", market, nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "embedding",
            sa.LargeBinary(),
            nullable=True,
            comment="Reserved for knowledge base / semantic search integration",
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("content_url", name="uq_collected_items_content_url"),
    )
    op.create_index(
        "ix_collected_items_category_market_collected_at",
        "collected_items",
        ["category", "market", "collected_at"],
    )
    op.create_index("ix_collected_items_expires_at", "collected_items", ["expires_at"])
    op.create_index(
        "ix_collected_items_source_id_collected_at",
        "collected_items",
        ["source_id", "collected_at"],
    )

    op.create_table(
        "watchlists",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("keywords", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("sources", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("markets", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_watchlists_user_id", "watchlists", ["user_id"])

    op.create_table(
        "user_report_configs",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("report_frequency", report_type, nullable=False),
        sa.Column("markets", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("categories", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "collector_logs",
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("status", collector_status, nullable=False),
        sa.Column("items_count", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column(
            "executed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_collector_logs_source_id_executed_at", "collector_logs", ["source_id", "executed_at"]
    )


def downgrade() -> None:
    """Revert initial SIGMA schema."""
    op.drop_index("ix_collector_logs_source_id_executed_at", table_name="collector_logs")
    op.drop_table("collector_logs")
    op.drop_table("user_report_configs")
    op.drop_index("ix_watchlists_user_id", table_name="watchlists")
    op.drop_table("watchlists")
    op.drop_index("ix_collected_items_source_id_collected_at", table_name="collected_items")
    op.drop_index("ix_collected_items_expires_at", table_name="collected_items")
    op.drop_index("ix_collected_items_category_market_collected_at", table_name="collected_items")
    op.drop_table("collected_items")
    op.drop_table("llm_usage_logs")
    op.drop_table("system_configs")
    op.drop_table("reports")
    op.drop_table("data_sources")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
