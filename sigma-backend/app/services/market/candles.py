"""Market candle refresh orchestration."""

# ruff: noqa: F401
import asyncio
import logging
import time as _time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.market import clock as market_clock
from app.services.market.candle_bootstrap import (
    _cold_start_fetch,
    _cold_start_next_piece,
    _cold_start_step_attempt,
    _cold_start_step_exceeded,
    _cold_start_step_key,
    _cold_start_step_reset,
    _cold_start_step_reset_all,
)
from app.services.market.candle_cache import (
    CANDLE_1D_KEY,
    CANDLE_1D_TTL,
    CANDLE_5D_KEY,
    CANDLE_5D_TTL,
    _deserialize_points,
    _filter_today,
    _redis_get_1d,
    _redis_get_5d,
    _redis_get_points,
    _redis_has_fresh_1d,
    _redis_has_fresh_5d,
    _redis_set_1d,
    _redis_set_5d,
    _redis_set_points,
    _serialize_points,
    _trim_to_n_trading_days,
)
from app.services.market.candle_fetch import (
    _candles_are_reasonable,
    _dedupe_points_by_timestamp,
    _end_of_day_downsample_if_needed,
    _fetch_and_store_1d_1min,
    _has_intraday_gap,
    _yahoo_fetch,
)
from app.services.market.candle_store import (
    _check_pg_candle_integrity,
    _downsample,
    _pg_delete_older_than_1y,
    _pg_get_candles,
    _pg_has_date,
    _pg_has_full_year,
    _pg_has_interval,
    _pg_upsert_candles,
)
from app.services.market.config import BEIJING_TZ, INDEX_CONFIGS, IndexConfig
from app.utils.redis_lock import create_redis_client

LOGGER = logging.getLogger(__name__)

TRADING_FETCH_INTERVAL = 10
COLD_START_NOT_OPEN_DELAY = 5
PRE_MARKET_WINDOW_MINUTES = 60
_MAX_COLD_START_ATTEMPTS_PER_STEP = 3
_DATA_HEALTH_CHECK_INTERVAL = 300
POST_CLOSE_RETRY_MINUTES = (1, 3)
POST_CLOSE_RETRY_WINDOW_MINUTES = 10
POST_CLOSE_REFETCH_WINDOW_MINUTES = (15, 20)

_last_fetch_time: dict[str, datetime] = {}
_cold_start_done: dict[str, bool] = {}
_cold_start_attempts: dict[str, int] = {}
_post_close_retry_slots: dict[str, tuple[date, set[int]]] = {}
_post_close_refetch_done: dict[str, date] = {}
_last_health_check = 0.0
_pg_integrity_checked = False


def _now_utc() -> datetime:
    return market_clock._now_utc()


def _as_float(value: object) -> float | None:
    return market_clock._as_float(value)


def _is_trading(config: IndexConfig, now: datetime | None = None) -> bool:
    return market_clock._is_trading(config, now or _now_utc())


def _is_within_session(timestamp: datetime, config: IndexConfig) -> bool:
    return market_clock._is_within_session(timestamp, config)


def _latest_session_date(config: IndexConfig, now: datetime | None = None) -> date:
    return market_clock._latest_session_date(config, now or _now_utc())


def _elapsed_trading_minutes(
    config: IndexConfig, session_date: date, now: datetime | None = None
) -> list[datetime]:
    return market_clock._elapsed_trading_minutes(config, session_date, now or _now_utc())


def _market_status_beijing(config: IndexConfig, now_beijing: datetime) -> str:
    return market_clock._market_status_beijing(config, now_beijing)


async def candle_refresh_job() -> None:
    """Refresh per-market candle storage without blocking quote refreshes."""
    global _last_health_check, _pg_integrity_checked
    if not _pg_integrity_checked:
        try:
            await _check_pg_candle_integrity()
        except Exception as exc:
            LOGGER.warning(
                "PostgreSQL candle integrity check failed: %s: %s", type(exc).__name__, exc
            )
        else:
            _pg_integrity_checked = True

    now_beijing = _now_utc().astimezone(BEIJING_TZ)
    _reset_post_close_refetch_done(now_beijing)

    cold_start_pending = [
        config for config in INDEX_CONFIGS if not _cold_start_done.get(config.symbol, False)
    ]
    if cold_start_pending:
        cold_start_pending.sort(
            key=lambda config: 0 if _market_status_beijing(config, now_beijing) == "trading" else 1
        )
        await asyncio.gather(
            *(
                _cold_start_fetch(config, _market_status_beijing(config, now_beijing))
                for config in cold_start_pending
            )
        )
    else:
        sorted_configs = sorted(
            INDEX_CONFIGS,
            key=lambda config: (
                0
                if _market_status_beijing(config, now_beijing) == "trading"
                else 1
                if _is_pre_market(config, now_beijing)
                else 2
            ),
        )
        await asyncio.gather(*(_process_market(config, now_beijing) for config in sorted_configs))

    now_mono = _time.monotonic()
    if now_mono - _last_health_check >= _DATA_HEALTH_CHECK_INTERVAL:
        _last_health_check = now_mono
        for config in INDEX_CONFIGS:
            if await _redis_has_fresh_1d(config):
                continue
            if _cold_start_done.get(config.symbol, False):
                LOGGER.warning(
                    "Health check: %s has no fresh 1D data. Resetting cold start.",
                    config.symbol,
                )
                _cold_start_done[config.symbol] = False
                _cold_start_step_reset_all(config.symbol)


async def _process_market(config: IndexConfig, now_beijing: datetime) -> None:
    status = _market_status_beijing(config, now_beijing)

    if status == "trading":
        last = _last_fetch_time.get(config.symbol)
        now_utc = _now_utc()
        if last is not None and (now_utc - last).total_seconds() < TRADING_FETCH_INTERVAL:
            return
        await _fetch_and_store_1d_1min(config)
        _last_fetch_time[config.symbol] = _now_utc()
        return

    if _is_pre_market(config, now_beijing):
        if await _redis_has_fresh_1d(config):
            return
        await _fetch_and_store_1d_1min(config)
        _last_fetch_time[config.symbol] = _now_utc()
        return

    if status == "closed":
        if _post_close_refetch_due(config, now_beijing):
            await _fetch_and_store_1d_1min(config, backfill_intraday_gap=True)
            _post_close_refetch_done[config.symbol] = _post_close_refetch_date(config, now_beijing)
            _last_fetch_time[config.symbol] = _now_utc()
        elif not await _redis_has_fresh_1d(config) or _post_close_retry_due(config, now_beijing):
            await _fetch_and_store_1d_1min(config)
            _last_fetch_time[config.symbol] = _now_utc()
        await _end_of_day_downsample_if_needed(config)


def _is_pre_market(config: IndexConfig, now_beijing: datetime) -> bool:
    """Return True within the warm-up window before the first session opens."""
    local_now = now_beijing.astimezone(ZoneInfo(config.timezone))
    if local_now.weekday() >= 5:
        return False
    current = local_now.time()
    first_open = config.sessions[0][0]
    current_mins = current.hour * 60 + current.minute
    open_mins = first_open.hour * 60 + first_open.minute
    diff = open_mins - current_mins
    return 0 < diff <= PRE_MARKET_WINDOW_MINUTES


def _post_close_retry_due(config: IndexConfig, now_beijing: datetime) -> bool:
    local_now = now_beijing.astimezone(ZoneInfo(config.timezone))
    session_date = _latest_session_date(config, now_beijing)
    close_local = datetime.combine(
        session_date, config.close_time, tzinfo=ZoneInfo(config.timezone)
    )
    if config.close_time <= config.open_time:
        close_local += timedelta(days=1)

    minutes_after_close = int((local_now - close_local).total_seconds() // 60)
    if (
        minutes_after_close < POST_CLOSE_RETRY_MINUTES[0]
        or minutes_after_close > POST_CLOSE_RETRY_WINDOW_MINUTES
    ):
        return False

    stored_date, completed_slots = _post_close_retry_slots.get(config.symbol, (session_date, set()))
    if stored_date != session_date:
        completed_slots = set()

    for retry_minute in POST_CLOSE_RETRY_MINUTES:
        if minutes_after_close >= retry_minute and retry_minute not in completed_slots:
            completed_slots.add(retry_minute)
            _post_close_retry_slots[config.symbol] = (session_date, completed_slots)
            return True

    _post_close_retry_slots[config.symbol] = (session_date, completed_slots)
    return False


def _post_close_refetch_date(config: IndexConfig, now_beijing: datetime) -> date:
    return now_beijing.astimezone(ZoneInfo(config.timezone)).date()


def _reset_post_close_refetch_done(now_beijing: datetime) -> None:
    configs_by_symbol = {config.symbol: config for config in INDEX_CONFIGS}
    for symbol, completed_date in list(_post_close_refetch_done.items()):
        config = configs_by_symbol.get(symbol)
        if config is None or completed_date != _post_close_refetch_date(config, now_beijing):
            _post_close_refetch_done.pop(symbol, None)


def _minutes_since_last_session_close(config: IndexConfig, now_beijing: datetime) -> int | None:
    zone = ZoneInfo(config.timezone)
    local_now = now_beijing.astimezone(zone)
    session_date = _latest_session_date(config, now_beijing)
    close_local = datetime.combine(session_date, config.close_time, tzinfo=zone)
    if config.close_time <= config.open_time:
        close_local += timedelta(days=1)
    if local_now < close_local:
        return None
    return int((local_now - close_local).total_seconds() // 60)


def _post_close_refetch_due(config: IndexConfig, now_beijing: datetime) -> bool:
    refetch_date = _post_close_refetch_date(config, now_beijing)
    if _post_close_refetch_done.get(config.symbol) == refetch_date:
        return False

    minutes_since_close = _minutes_since_last_session_close(config, now_beijing)
    if minutes_since_close is None:
        return False

    min_minutes, max_minutes = POST_CLOSE_REFETCH_WINDOW_MINUTES
    return min_minutes <= minutes_since_close <= max_minutes
