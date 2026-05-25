from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import LLMFunctionType


class LLMUsageLog(UUIDPrimaryKeyMixin, Base):
    """LLM provider token usage audit record."""

    __tablename__ = "llm_usage_logs"

    provider: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(160), nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    function_type: Mapped[LLMFunctionType] = mapped_column(
        Enum(LLMFunctionType, name="llm_function_type", values_callable=enum_values),
        nullable=False,
    )
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
