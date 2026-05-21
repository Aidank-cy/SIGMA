import type { MarketIndex, TradingHours } from "@/lib/types";

export const MARKET_ACTIVE_REFETCH_INTERVAL_MS = 15_000;
export const MARKET_CLOSED_REFETCH_INTERVAL_MS = 120_000;

export type MarketAxisDomain = [string, string] | [number, number];

interface ZonedParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  weekday: number;
  year: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) {
    return cached;
  }
  const next = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });
  formatters.set(timeZone, next);
  return next;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = values.hour === "24" ? 0 : Number(values.hour);
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return {
    day,
    hour,
    minute: Number(values.minute),
    month,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    year
  };
}

function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function isWeekday(parts: ZonedParts): boolean {
  return parts.weekday !== 0 && parts.weekday !== 6;
}

export function isTradingHoursActive(tradingHours: TradingHours, now = new Date()): boolean {
  const parts = zonedParts(now, tradingHours.timezone);
  if (!isWeekday(parts)) {
    return false;
  }

  const currentMinutes = parts.hour * 60 + parts.minute;
  return tradingHours.sessions.some((session) => {
    const openMinutes = timeToMinutes(session.open);
    const closeMinutes = timeToMinutes(session.close);
    if (closeMinutes <= openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  });
}

export function isPreMarketClearWindow(tradingHours: TradingHours, now = new Date()): boolean {
  const firstSession = tradingHours.sessions[0];
  if (!firstSession) {
    return false;
  }
  const parts = zonedParts(now, tradingHours.timezone);
  if (!isWeekday(parts)) {
    return false;
  }

  const minutesUntilOpen = timeToMinutes(firstSession.open) - (parts.hour * 60 + parts.minute);
  return minutesUntilOpen > 0 && minutesUntilOpen <= 60;
}

export function anyMarketTrading(indices: MarketIndex[] = [], now = new Date()): boolean {
  return indices.some((index) => index.is_trading || isTradingHoursActive(index.trading_hours, now));
}

export function marketIndicesRefetchInterval(indices: MarketIndex[] = [], now = new Date()): number {
  return anyMarketTrading(indices, now) ? MARKET_ACTIVE_REFETCH_INTERVAL_MS : MARKET_CLOSED_REFETCH_INTERVAL_MS;
}

export function sparklineAxisDomain(data?: Array<number | { value?: number | null }>): MarketAxisDomain {
  if (!Array.isArray(data)) {
    return ["dataMin - 10", "dataMax + 10"];
  }
  const values = data
    .map((point) => (typeof point === "number" ? point : point?.value))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length < 2) {
    return ["dataMin - 10", "dataMax + 10"];
  }

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const dataRange = dataMax - dataMin;
  const indexValue = Math.max(Math.abs(dataMax), 1);
  const minRange = indexValue * 0.005;

  if (dataRange < minRange) {
    const midpoint = (dataMin + dataMax) / 2;
    return [midpoint - minRange / 2, midpoint + minRange / 2];
  }

  const padding = dataRange * 0.15;
  return [dataMin - padding, dataMax + padding];
}
