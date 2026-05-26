"""Add missing columns and enum values from manual ALTER TABLE commands."""

from alembic import op

revision = "20260526_manual"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'daily_morning'")
    op.execute("ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'daily_afternoon'")

    op.execute("""
        DO $$ BEGIN
            ALTER TABLE llm_usage_logs ADD COLUMN user_id UUID REFERENCES users(id);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_report_configs ADD COLUMN report_frequencies JSONB DEFAULT '[]'::jsonb;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_report_configs ADD COLUMN time_ranges JSONB DEFAULT '{}}'::jsonb;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)


def downgrade() -> None:
    op.drop_column("user_report_configs", "time_ranges")
    op.drop_column("user_report_configs", "report_frequencies")
    op.drop_column("llm_usage_logs", "user_id")
