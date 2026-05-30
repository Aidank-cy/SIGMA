"""add_market_candles

Revision ID: 20260522_0003
Revises: 20260517_0002
Create Date: 2026-05-22 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260522_0003"
down_revision: str | None = "20260517_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add multi-granularity market candle storage."""
    op.create_table(
        "market_candles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("interval", sa.String(length=5), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("close", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol", "interval", "timestamp", name="uq_market_candle"),
    )
    op.create_index(
        "ix_market_candle_lookup",
        "market_candles",
        ["symbol", "interval", "timestamp"],
        unique=False,
    )


def downgrade() -> None:
    """Remove multi-granularity market candle storage."""
    op.drop_index("ix_market_candle_lookup", table_name="market_candles")
    op.drop_table("market_candles")
