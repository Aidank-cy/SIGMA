"""Remove deprecated system-level LLM config rows.

Revision ID: 20260524_0005
Revises: 20260523_0004
Create Date: 2026-05-24
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260524_0005"
down_revision: str | None = "20260523_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEPRECATED_KEYS = (
    "sigma.llm.provider",
    "sigma.llm.model",
    "sigma.llm.daily_token_limit",
    "sigma.llm.cost_guard_enabled",
    "sigma.llm.api_keys",
)


def upgrade() -> None:
    keys = ", ".join(f"'{key}'" for key in DEPRECATED_KEYS)
    op.execute(f"DELETE FROM system_config WHERE key IN ({keys})")


def downgrade() -> None:
    pass
