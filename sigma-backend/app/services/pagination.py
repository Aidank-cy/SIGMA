"""Reusable pagination utilities for list endpoints."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class Page[T]:
    """Represent one paginated query result."""

    items: Sequence[T]
    total: int
    page: int
    page_size: int

    @property
    def has_next(self) -> bool:
        """Return whether a later page exists."""
        return (self.page * self.page_size) < self.total


async def paginate(
    db: AsyncSession,
    statement: Select[Any],
    page: int = 1,
    page_size: int = 20,
    count_statement: Select[Any] | None = None,
) -> Page[Any]:
    """Execute a paginated row query and return rows with total count."""
    total = await _count(db, statement, count_statement)
    rows = (await db.execute(_paged_statement(statement, page, page_size))).all()
    return Page(items=rows, total=total, page=page, page_size=page_size)


async def paginate_scalars(
    db: AsyncSession,
    statement: Select[Any],
    page: int = 1,
    page_size: int = 20,
    count_statement: Select[Any] | None = None,
) -> Page[Any]:
    """Execute a paginated scalar query and return items with total count."""
    total = await _count(db, statement, count_statement)
    items = list(await db.scalars(_paged_statement(statement, page, page_size)))
    return Page(items=items, total=total, page=page, page_size=page_size)


async def _count(
    db: AsyncSession, statement: Select[Any], count_statement: Select[Any] | None
) -> int:
    resolved_count_statement = (
        count_statement
        if count_statement is not None
        else select(func.count()).select_from(
            statement.order_by(None).limit(None).offset(None).subquery()
        )
    )
    return int(await db.scalar(resolved_count_statement) or 0)


def _paged_statement(statement: Select[Any], page: int, page_size: int) -> Select[Any]:
    return statement.offset((page - 1) * page_size).limit(page_size)
