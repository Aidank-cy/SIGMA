"""add_report_sentiment_score

Revision ID: 20260517_0002
Revises: 20260516_0001
Create Date: 2026-05-17 05:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260517_0002"
down_revision: str | None = "20260516_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add report sentiment score for report card summaries."""
    op.add_column(
        "reports",
        sa.Column("sentiment_score", sa.Float(), server_default="0.5", nullable=False),
    )
    op.alter_column("reports", "sentiment_score", server_default=None)


def downgrade() -> None:
    """Remove report sentiment score."""
    op.drop_column("reports", "sentiment_score")
