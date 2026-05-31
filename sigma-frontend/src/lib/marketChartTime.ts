import type { MarketIndex } from "@/lib/types";
import type { MarketChartPoint } from "./marketChart";

export type TradingSessions = MarketIndex["trading_hours"]["sessions"];

interface IntradayAxisSegment { axisEnd: number; axisStart: number; close: string; open: string; realClose: number; realOpen: number; }

interface TradingDateKeysForRangeInput { activeRange: string; now?: Date; points?: MarketChartPoint[]; sessions?: TradingSessions; timeZone?: string; }

export const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const dayMs = 24 * 60 * 60 * 1000;

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatters.get(timeZone);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

export function timeParts(timestamp: string, timeZone = "Asia/Shanghai"): { date: string; hour: number; minute: number; time: string } {
  const parts = dateTimeFormatter(timeZone).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const normalizedHour = values.hour === "24" ? "00" : values.hour;
  const time = `${normalizedHour}:${values.minute}`;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(normalizedHour),
    minute: Number(values.minute),
    time
  };
}

export function formatShortDate(timestamp: string, timeZone = "Asia/Shanghai"): string {
  const parts = timeParts(timestamp, timeZone);
  const month = Number(parts.date.slice(5, 7));
  const day = Number(parts.date.slice(8, 10));
  return `${month}/${day}`;
}

function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function formatMinutes(value: number): string {
  const normalized = ((Math.round(value) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeAxisMinute(minutes: number, axisStart: number): number {
  const dayMinutes = 24 * 60;
  const normalized = ((minutes % dayMinutes) + dayMinutes) % dayMinutes;
  return normalized < axisStart ? normalized + dayMinutes : normalized;
}

export function chartTradingSessions(index: MarketIndex): TradingSessions {
  return index.trading_hours.beijing_sessions?.length
    ? index.trading_hours.beijing_sessions
    : index.trading_hours.sessions;
}

export function sessionDateKey(timestamp: string, sessions: TradingSessions = [], timeZone = "Asia/Shanghai"): string {
  const parts = timeParts(timestamp, timeZone);
  const pointMinute = parts.hour * 60 + parts.minute;
  const overnightSession = sessions.find((session) => timeToMinutes(session.close) < timeToMinutes(session.open));
  if (overnightSession && pointMinute < timeToMinutes(overnightSession.close)) {
    return addDays(parts.date, -1);
  }
  return parts.date;
}

function buildIntradayAxisSegments(sessions: TradingSessions = []): IntradayAxisSegment[] {
  const firstSession = sessions[0];
  if (!firstSession) {
    return [];
  }
  const firstOpen = timeToMinutes(firstSession.open);
  let nextAxisStart = 0;

  return sessions.map((session) => {
    const realOpen = normalizeAxisMinute(timeToMinutes(session.open), firstOpen);
    let realClose = normalizeAxisMinute(timeToMinutes(session.close), firstOpen);
    if (realClose <= realOpen) {
      realClose += 24 * 60;
    }
    const axisStart = nextAxisStart;
    const axisEnd = axisStart + realClose - realOpen;
    nextAxisStart = axisEnd + 1;
    return {
      axisEnd,
      axisStart,
      close: session.close,
      open: session.open,
      realClose,
      realOpen
    };
  });
}

export function intradayAxisBounds(sessions: TradingSessions = []): [number, number] {
  const segments = buildIntradayAxisSegments(sessions);
  const lastSegment = segments[segments.length - 1];
  return [0, Math.max(lastSegment?.axisEnd ?? 1, 1)];
}

export function intradayPointPosition(timestamp: string, sessions: TradingSessions = [], timeZone = "Asia/Shanghai"): number | null {
  const firstSession = sessions[0];
  if (!firstSession) {
    return null;
  }
  const axisStart = timeToMinutes(firstSession.open);
  const parts = timeParts(timestamp, timeZone);
  const realMinute = normalizeAxisMinute(parts.hour * 60 + parts.minute, axisStart);
  const segments = buildIntradayAxisSegments(sessions);
  for (const minute of [realMinute, realMinute - 24 * 60, realMinute + 24 * 60]) {
    const segment = segments.find((item) => minute >= item.realOpen && minute <= item.realClose);
    if (segment) {
      return segment.axisStart + minute - segment.realOpen;
    }
  }
  return null;
}

export function intradayProgress(timestamp: string, sessions: TradingSessions = [], timeZone = "Asia/Shanghai"): number {
  const [, axisEnd] = intradayAxisBounds(sessions);
  const position = intradayPointPosition(timestamp, sessions, timeZone);
  if (position === null) {
    return 0;
  }
  return Math.min(1, Math.max(0, position / Math.max(axisEnd, 1)));
}

export function buildIntradayAxisTicks(sessions: TradingSessions = []): number[] {
  const segments = buildIntradayAxisSegments(sessions);
  const lastSegment = segments[segments.length - 1];
  const ticks = new Set<number>([0, lastSegment?.axisEnd ?? 1]);

  segments.forEach((segment, segmentIndex) => {
    ticks.add(segment.axisEnd);
    if (segmentIndex === 0) {
      ticks.add(segment.axisStart);
    }
    for (let tick = Math.ceil(segment.realOpen / 30) * 30; tick <= segment.realClose; tick += 30) {
      if (tick === segment.realOpen && segmentIndex > 0) {
        continue;
      }
      ticks.add(segment.axisStart + tick - segment.realOpen);
    }
  });
  return Array.from(ticks).sort((left, right) => left - right);
}

export function buildIntradayBreakTicks(sessions: TradingSessions = []): number[] {
  return buildIntradayAxisSegments(sessions)
    .slice(0, -1)
    .map((segment) => segment.axisEnd);
}

export function formatIntradayAxisTick(value: number, sessions: TradingSessions = []): string {
  const rounded = Math.round(value);
  const segments = buildIntradayAxisSegments(sessions);
  if (segments.length === 0) {
    return formatMinutes(value);
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    if (nextSegment && rounded === segment.axisEnd) {
      return `${segment.close}/${nextSegment.open}`;
    }
    if (rounded >= segment.axisStart && rounded <= segment.axisEnd) {
      return formatMinutes(segment.realOpen + rounded - segment.axisStart);
    }
  }

  return "";
}

function localDateKey(date: Date, timeZone = "Asia/Shanghai"): string {
  return timeParts(date.toISOString(), timeZone).date;
}

function dateKeyToUtcDate(dateKey: string): Date {
  const [year = "1970", month = "01", day = "01"] = dateKey.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function utcDateToKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number): string {
  return utcDateToKey(new Date(dateKeyToUtcDate(dateKey).getTime() + days * dayMs));
}

export function isWeekdayDateKey(dateKey: string): boolean {
  const day = dateKeyToUtcDate(dateKey).getUTCDay();
  return day !== 0 && day !== 6;
}

export function latestAxisDateKey(now: Date, timeZone = "Asia/Shanghai"): string {
  let dateKey = localDateKey(now, timeZone);
  while (!isWeekdayDateKey(dateKey)) {
    dateKey = addDays(dateKey, -1);
  }
  return dateKey;
}

function fiveDayAxisDateKeys(now = new Date(), timeZone = "Asia/Shanghai"): string[] {
  let dateKey = latestAxisDateKey(now, timeZone);
  const dates: string[] = [];
  while (dates.length < 5) {
    if (isWeekdayDateKey(dateKey)) {
      dates.push(dateKey);
    }
    dateKey = addDays(dateKey, -1);
  }
  return dates.reverse();
}

export function formatDateKeyShort(dateKey: string): string {
  const [, month = "01", day = "01"] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function monthLabelForDateKey(dateKey: string): string {
  const month = Number(dateKey.slice(5, 7));
  return monthLabels[month - 1] ?? formatDateKeyShort(dateKey);
}

export function spansMultipleDays(points: MarketChartPoint[], timeZone = "Asia/Shanghai"): boolean {
  return new Set(points.map((point) => timeParts(point.timestamp, timeZone).date)).size > 1;
}

export function fallbackTradingDateKeys(activeRange: string, now = new Date(), timeZone = "Asia/Shanghai"): string[] {
  if (activeRange === "5D") {
    return fiveDayAxisDateKeys(now, timeZone);
  }
  const pointCounts: Record<string, number> = { "1M": 22, "3M": 66, "1Y": 252 };
  const targetCount = pointCounts[activeRange] ?? 22;
  let dateKey = latestAxisDateKey(now, timeZone);
  const dateKeys: string[] = [];
  while (dateKeys.length < targetCount) {
    if (isWeekdayDateKey(dateKey)) {
      dateKeys.push(dateKey);
    }
    dateKey = addDays(dateKey, -1);
  }
  return dateKeys.reverse();
}

export function tradingDateKeysFromPoints(
  points: Array<{ timestamp: string }>,
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai"
): string[] {
  return Array.from(
    new Set(
      points
        .map((point) => sessionDateKey(point.timestamp, sessions, timeZone))
        .filter((dateKey) => isWeekdayDateKey(dateKey))
    )
  ).sort();
}

export function tradingDateKeysForRange({
  activeRange,
  now = new Date(),
  points = [],
  sessions = [],
  timeZone = "Asia/Shanghai"
}: TradingDateKeysForRangeInput): string[] {
  const dateKeys = tradingDateKeysFromPoints(points, sessions, timeZone);
  return dateKeys.length > 0 ? dateKeys : fallbackTradingDateKeys(activeRange, now, timeZone);
}

export function tradingDayPosition(timestamp: string, dayIndex: number, sessions: TradingSessions = [], timeZone = "Asia/Shanghai"): number {
  return dayIndex + intradayProgress(timestamp, sessions, timeZone);
}
