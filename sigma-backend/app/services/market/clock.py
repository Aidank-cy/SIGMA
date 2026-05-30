"""Market clock helpers shared by quote and candle services."""

from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.schemas.market import TradingSession
from app.services.market.config import BEIJING_TZ, INDEX_CONFIGS, IndexConfig


def any_market_trading_now(now: datetime | None = None) -> bool:
    """Return whether any configured exchange is inside regular trading hours."""
    return any(_is_trading(config, now) for config in INDEX_CONFIGS)


def _market_status_beijing(config: IndexConfig, now_beijing: datetime) -> str:
    """Return not_opened, trading, or closed using the market clock observed from Beijing."""
    local_now = now_beijing.astimezone(ZoneInfo(config.timezone))
    if local_now.weekday() >= 5:
        return "closed"

    current = local_now.time().replace(tzinfo=None)
    if any(
        _time_in_session(current, session_open, session_close)
        for session_open, session_close in config.sessions
    ):
        return "trading"
    if any(current < session_open for session_open, _session_close in config.sessions):
        return "not_opened"
    return "closed"


def _is_trading(config: IndexConfig, now: datetime | None = None) -> bool:
    active_now = (now or _now_utc()).astimezone(ZoneInfo(config.timezone))
    if active_now.weekday() >= 5:
        return False
    current = active_now.time().replace(tzinfo=None)
    return any(
        _time_in_session(current, session_open, session_close)
        for session_open, session_close in config.sessions
    )


def _is_within_session(timestamp: datetime, config: IndexConfig) -> bool:
    local = timestamp.astimezone(ZoneInfo(config.timezone))
    if local.weekday() >= 5:
        return False
    current = local.time().replace(tzinfo=None)
    return any(
        _time_in_session(current, session_open, session_close)
        for session_open, session_close in config.sessions
    )


def _time_in_session(current: time, session_open: time, session_close: time) -> bool:
    if session_close <= session_open:
        return current >= session_open or current <= session_close
    return session_open <= current <= session_close


def _sessions_to_beijing(config: IndexConfig) -> list[TradingSession]:
    """Convert a market's latest exchange sessions to Beijing wall-clock labels."""
    session_date = _latest_session_date(config)
    zone = ZoneInfo(config.timezone)
    beijing_sessions: list[TradingSession] = []
    for session_open, session_close in config.sessions:
        open_local = datetime.combine(session_date, session_open, tzinfo=zone)
        close_local = datetime.combine(session_date, session_close, tzinfo=zone)
        if session_close <= session_open:
            close_local += timedelta(days=1)
        open_beijing = open_local.astimezone(BEIJING_TZ)
        close_beijing = close_local.astimezone(BEIJING_TZ)
        beijing_sessions.append(
            TradingSession(
                open=open_beijing.strftime("%H:%M"),
                close=close_beijing.strftime("%H:%M"),
            )
        )
    return beijing_sessions


def _trading_minutes(config: IndexConfig, session_date: date) -> list[datetime]:
    zone = ZoneInfo(config.timezone)
    timestamps: list[datetime] = []
    for session_open, session_close in config.sessions:
        start = datetime.combine(session_date, session_open, tzinfo=zone)
        end = datetime.combine(session_date, session_close, tzinfo=zone)
        if session_close <= session_open:
            end += timedelta(days=1)
        current = start
        while current <= end:
            timestamps.append(current.astimezone(BEIJING_TZ).replace(second=0, microsecond=0))
            current += timedelta(minutes=1)
    return timestamps


def _latest_session_date(config: IndexConfig, now: datetime | None = None) -> date:
    local_now = (now or _now_utc()).astimezone(ZoneInfo(config.timezone))
    session_date = local_now.date()
    if local_now.time().replace(tzinfo=None) < config.open_time:
        session_date -= timedelta(days=1)
    while session_date.weekday() >= 5:
        session_date -= timedelta(days=1)
    return session_date


def _elapsed_trading_minutes(
    config: IndexConfig, session_date: date, now: datetime | None = None
) -> list[datetime]:
    timestamps = _trading_minutes(config, session_date)
    local_now = (now or _now_utc()).astimezone(ZoneInfo(config.timezone))
    if (
        local_now.date() != session_date
        or local_now.time().replace(tzinfo=None) >= config.close_time
    ):
        return timestamps
    cutoff = local_now.astimezone(BEIJING_TZ).replace(second=0, microsecond=0)
    elapsed = [timestamp for timestamp in timestamps if timestamp <= cutoff]
    return elapsed or timestamps[:1]


def _previous_close_from_change(value: float, change_pct: float) -> float:
    if change_pct == -100:
        return value
    previous = value / (1 + change_pct / 100)
    return previous if previous > 0 else value


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _timestamp_from_epoch(value: Any) -> datetime | None:
    epoch = _as_float(value)
    if epoch is None or epoch <= 0:
        return None
    return datetime.fromtimestamp(epoch, tz=UTC)


def _timestamp_from_exchange_fields(
    config: IndexConfig, date_value: Any, time_value: Any
) -> datetime | None:
    date_text = str(date_value or "").strip()
    time_text = str(time_value or "").strip()
    if not date_text or not time_text or date_text.upper() == "N/D" or time_text.upper() == "N/D":
        return None
    try:
        local_date = date.fromisoformat(date_text)
        time_parts = time_text.split(":")
        local_time = time(
            hour=int(time_parts[0]),
            minute=int(time_parts[1]) if len(time_parts) > 1 else 0,
            second=int(time_parts[2]) if len(time_parts) > 2 else 0,
        )
    except (TypeError, ValueError):
        return None
    return datetime.combine(local_date, local_time, tzinfo=ZoneInfo(config.timezone))
