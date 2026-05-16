from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.types import jsonb_type

if TYPE_CHECKING:
    from app.models.user import User


class Watchlist(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User watchlist for source, market, and keyword filters."""

    __tablename__ = "watchlists"
    __table_args__ = (Index("ix_watchlists_user_id", "user_id"),)

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    keywords: Mapped[list[str]] = mapped_column(jsonb_type(), default=list, nullable=False)
    sources: Mapped[list[Any]] = mapped_column(jsonb_type(), default=list, nullable=False)
    markets: Mapped[list[str]] = mapped_column(jsonb_type(), default=list, nullable=False)

    user: Mapped[User] = relationship(back_populates="watchlists")
