from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin
from app.models.types import jsonb_type


class SystemConfig(UUIDPrimaryKeyMixin, Base):
    """Namespaced runtime system configuration."""

    __tablename__ = "system_configs"

    key: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    value: Mapped[dict[str, Any]] = mapped_column(jsonb_type(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
