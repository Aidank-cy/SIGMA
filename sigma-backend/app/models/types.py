from typing import Any

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeEngine


def jsonb_type() -> TypeEngine[dict[str, Any]]:
    """Return JSONB on PostgreSQL and portable JSON elsewhere."""
    return JSON().with_variant(JSONB, "postgresql")
