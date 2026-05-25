import { isPreMarketClearWindow } from "@/lib/marketSessions";
import type { MarketIndex } from "@/lib/types";

export const marketChartRanges = ["1D", "5D", "1M", "3M", "1Y"] as const;

export type MarketChartRange = (typeof marketChartRanges)[number];
export type MarketChartAxisDomain = [number, number];

type TradingSessions = MarketIndex["trading_hours"]["sessions"];

export interface MarketChartPoint {
  time: number;
  timestamp: string;
  value: number;
}

interface IntradayAxisSegment {
  axisEnd: number;
  axisStart: number;
  close: string;
  open: string;
  realClose: number;
  realOpen: number;
}

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const warnedChartFallbacks = new Set<string>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const calendarRangeDays: Record<string, number> = { "1M": 30, "3M": 90, "1Y": 365 };
const dayMs = 24 * 60 * 60 * 1000;

function warnChartFallback(key: string, message: string): void {
  if (warnedChartFallbacks.has(key)) {
    return;
  }
  warnedChartFallbacks.add(key);
  console.warn(message);
}

function generateChartData(points: number, value: number, positive: boolean, label = "market index"): MarketChartPoint[] {
  warnChartFallback(
    label,
    `SIGMA is displaying generated fallback chart data for ${label} because the API response did not include a usable sparkline.`
  );
  const floor = value * 0.975;
  const ceiling = value * 1.025;
  let current = positive ? value * 0.985 : value * 1.015;

  return Array.from({ length: points }).map((_, index) => {
    const wave = Math.sin(index / 4) * value * 0.0025;
    const drift = positive ? index * value * 0.00018 : -index * value * 0.00018;
    current = Math.min(ceiling, Math.max(floor, current + wave + drift));
    const totalMinutes = 9 * 60 + 30 + index;
    const day = totalMinutes >= 24 * 60 ? "02" : "01";
    const hour = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minute = totalMinutes % 60;
    const timestamp = `2026-01-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
    return { time: index, timestamp, value: Math.round(current * 100) / 100 };
  });
}

function generateRangeChartData(
  activeRange: string,
  value: number,
  positive: boolean,
  label = "market index",
  now = new Date(),
  timeZone = "Asia/Shanghai"
): MarketChartPoint[] {
  const pointCounts: Record<string, number> = { "5D": 5, "1M": 22, "3M": 66, "1Y": 252 };
  const points = pointCounts[activeRange] ?? 22;
  warnChartFallback(
    `${label}-${activeRange}`,
    `SIGMA is displaying generated fallback ${activeRange} chart data for ${label} because the API response did not include a usable historical sparkline.`
  );
  let currentDate = dateKeyToUtcDate(latestAxisDateKey(now, timeZone));
  const dateKeys: string[] = [];
  while (dateKeys.length < points) {
    if (currentDate.getUTCDay() !== 0 && currentDate.getUTCDay() !== 6) {
      dateKeys.push(utcDateToKey(currentDate));
    }
    currentDate = new Date(currentDate.getTime() - dayMs);
  }
  dateKeys.reverse();

  const start = positive ? value * 0.985 : value * 1.015;
  return dateKeys.map((dateKey, index) => {
    const progress = points <= 1 ? 1 : index / (points - 1);
    const wave = Math.sin(progress * Math.PI * 4) * value * 0.003;
    const pointValue = start + (value - start) * progress + wave;
    return { time: index, timestamp: dateKeyToNoonUtcTimestamp(dateKey), value: Math.round(pointValue * 100) / 100 };
  });
}

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

function chartTradingSessions(index: MarketIndex): TradingSessions {
  return index.trading_hours.beijing_sessions?.length
    ? index.trading_hours.beijing_sessions
    : index.trading_hours.sessions;
}

function sessionDateKey(timestamp: string, sessions: TradingSessions = [], timeZone = "Asia/Shanghai"): string {
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

function intradayAxisBounds(sessions: TradingSessions = []): MarketChartAxisDomain {
  const segments = buildIntradayAxisSegments(sessions);
  const lastSegment = segments[segments.length - 1];
  return [0, Math.max(lastSegment?.axisEnd ?? 1, 1)];
}

function intradayPointPosition(timestamp: string, sessions: TradingSessions = [], timeZone = "Asia/Shanghai"): number | null {
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

function intradayProgress(timestamp: string, sessions: TradingSessions = [], timeZone = "Asia/Shanghai"): number {
  const [, axisEnd] = intradayAxisBounds(sessions);
  const position = intradayPointPosition(timestamp, sessions, timeZone);
  if (position === null) {
    return 0;
  }
  return Math.min(1, Math.max(0, position / Math.max(axisEnd, 1)));
}

function buildIntradayAxisTicks(sessions: TradingSessions = []): number[] {
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

function buildIntradayBreakTicks(sessions: TradingSessions = []): number[] {
  return buildIntradayAxisSegments(sessions)
    .slice(0, -1)
    .map((segment) => segment.axisEnd);
}

function formatIntradayAxisTick(value: number, sessions: TradingSessions = []): string {
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

function isWeekdayDateKey(dateKey: string): boolean {
  const day = dateKeyToUtcDate(dateKey).getUTCDay();
  return day !== 0 && day !== 6;
}

function latestAxisDateKey(now: Date, timeZone = "Asia/Shanghai"): string {
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

function dateKeyToNoonUtcTimestamp(dateKey: string): string {
  return `${dateKey}T12:00:00.000Z`;
}

function formatDateKeyShort(dateKey: string): string {
  const [, month = "01", day = "01"] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function monthLabelForDateKey(dateKey: string): string {
  const month = Number(dateKey.slice(5, 7));
  return monthLabels[month - 1] ?? formatDateKeyShort(dateKey);
}

export function spansMultipleDays(points: MarketChartPoint[], timeZone = "Asia/Shanghai"): boolean {
  return new Set(points.map((point) => timeParts(point.timestamp, timeZone).date)).size > 1;
}

function fallbackTradingDateKeys(activeRange: string, now = new Date(), timeZone = "Asia/Shanghai"): string[] {
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

function tradingDateKeysFromPoints(
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

function tradingDateKeysForRange(
  activeRange: string,
  points: MarketChartPoint[] = [],
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai",
  now = new Date()
): string[] {
  const dateKeys = tradingDateKeysFromPoints(points, sessions, timeZone);
  return dateKeys.length > 0 ? dateKeys : fallbackTradingDateKeys(activeRange, now, timeZone);
}

function tradingDayPosition(
  timestamp: string,
  dayIndex: number,
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai"
): number {
  return dayIndex + intradayProgress(timestamp, sessions, timeZone);
}

export function toIntradayChartData(index: MarketIndex, now = new Date(), clearPreMarket = true): MarketChartPoint[] {
  if (clearPreMarket && isPreMarketClearWindow(index.trading_hours, now)) {
    return [];
  }

  const chartSessions = chartTradingSessions(index);
  const chartTimeZone = "Asia/Shanghai";
  const sparkline = index.sparkline_24h;
  const timestamps = index.sparkline_times ?? [];
  if (sparkline.length > 0 && timestamps.length === sparkline.length) {
    const currentDateKey = latestAxisDateKey(now, chartTimeZone);
    const points = sparkline.flatMap((point, pointIndex) => {
      const timestamp = timestamps[pointIndex];
      if (!timestamp) {
        return [];
      }
      const dateKey = sessionDateKey(timestamp, chartSessions, chartTimeZone);
      if (dateKey !== currentDateKey) {
        return [];
      }
      const position = intradayPointPosition(timestamp, chartSessions, chartTimeZone);
      if (position === null) {
        return [];
      }
      return [{
        time: position,
        timestamp,
        value: point
      }];
    });
    if (points.length > 0) {
      return points;
    }
  }

  const [, axisEnd] = intradayAxisBounds(chartSessions);
  return generateChartData(60, index.value || 100, index.change_pct >= 0, index.symbol).map((point, pointIndex) => ({
    ...point,
    time: Math.min(pointIndex, axisEnd)
  }));
}

function toFiveDayChartData(index: MarketIndex, now = new Date()): MarketChartPoint[] {
  const timeZone = "Asia/Shanghai";
  const chartSessions = chartTradingSessions(index);
  const range = index.sparkline_ranges?.["5D"];
  const rangeValues = range?.values ?? [];
  const rangeTimes = range?.times ?? [];
  const source =
    rangeValues.length > 0 && rangeTimes.length === rangeValues.length
      ? rangeValues.map((value, pointIndex) => ({ timestamp: rangeTimes[pointIndex], value }))
      : generateRangeChartData("5D", index.value || 100, index.change_pct >= 0, index.symbol, now, timeZone);
  const intraday = toIntradayChartData(index, now);
  const dateKeys = tradingDateKeysFromPoints(
    [
      ...source,
      ...intraday.map((point) => ({ timestamp: point.timestamp }))
    ],
    chartSessions,
    timeZone
  ).slice(-5);
  const dateIndexByKey = new Map(dateKeys.map((dateKey, index) => [dateKey, index]));
  const pointsByTimestamp = new Map<string, MarketChartPoint>();

  source.forEach((point) => {
    const dateKey = sessionDateKey(point.timestamp, chartSessions, timeZone);
    const dayIndex = dateIndexByKey.get(dateKey);
    if (dayIndex === undefined || !isWeekdayDateKey(dateKey)) {
      return;
    }
    pointsByTimestamp.set(point.timestamp, {
      time: tradingDayPosition(point.timestamp, dayIndex, chartSessions, timeZone),
      timestamp: point.timestamp,
      value: point.value
    });
  });

  const currentDateKey = dateKeys[dateKeys.length - 1];
  const currentDayIndex = dateKeys.length - 1;
  const currentIntraday = intraday.filter((point) => sessionDateKey(point.timestamp, chartSessions, timeZone) === currentDateKey);
  currentIntraday.forEach((point) => {
    pointsByTimestamp.set(point.timestamp, {
      ...point,
      time: tradingDayPosition(point.timestamp, currentDayIndex, chartSessions, timeZone)
    });
  });

  return Array.from(pointsByTimestamp.values()).sort((left, right) => left.time - right.time);
}

function toCalendarRangeChartData(index: MarketIndex, activeRange: string, now = new Date()): MarketChartPoint[] {
  const timeZone = "Asia/Shanghai";
  const chartSessions = chartTradingSessions(index);
  const range = index.sparkline_ranges?.[activeRange];
  const rangeValues = range?.values ?? [];
  const rangeTimes = range?.times ?? [];
  const source =
    rangeValues.length > 0 && rangeTimes.length === rangeValues.length
      ? rangeValues.map((value, pointIndex) => ({ timestamp: rangeTimes[pointIndex], value }))
      : generateRangeChartData(activeRange, index.value || 100, index.change_pct >= 0, index.symbol, now, timeZone);
  const dateKeys = tradingDateKeysFromPoints(source, chartSessions, timeZone);
  const dateIndexByKey = new Map(dateKeys.map((dateKey, index) => [dateKey, index]));

  return source
    .flatMap((point) => {
      const dateKey = sessionDateKey(point.timestamp, chartSessions, timeZone);
      const dayIndex = dateIndexByKey.get(dateKey);
      if (dayIndex === undefined || !isWeekdayDateKey(dateKey)) {
        return [];
      }
      return {
        time: tradingDayPosition(point.timestamp, dayIndex, chartSessions, timeZone),
        timestamp: point.timestamp,
        value: point.value
      };
    })
    .sort((left, right) => left.time - right.time);
}

export function toMarketChartData(index: MarketIndex, activeRange = "1D", now = new Date()): MarketChartPoint[] {
  if (activeRange === "1D") {
    return toIntradayChartData(index, now);
  }
  if (activeRange === "5D") {
    return toFiveDayChartData(index, now);
  }
  return toCalendarRangeChartData(index, activeRange, now);
}

export function toMarketChartDataByRange(index: MarketIndex, now = new Date()): Record<string, MarketChartPoint[]> {
  return Object.fromEntries(marketChartRanges.map((range) => [range, toMarketChartData(index, range, now)]));
}

export function buildChartXAxisDomain(
  activeRange: string,
  sessions: TradingSessions = [],
  points: MarketChartPoint[] = []
): MarketChartAxisDomain {
  if (activeRange === "1D") {
    return intradayAxisBounds(sessions);
  }
  if (points.length > 0) {
    return [0, Math.max(...points.map((point) => point.time), 1)];
  }
  const dateKeys = fallbackTradingDateKeys(activeRange);
  return [0, Math.max(dateKeys.length - 1, 1)];
}

export function buildChartTicks(
  activeRange: string,
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai",
  now = new Date(),
  points: MarketChartPoint[] = []
): number[] {
  if (activeRange === "1D") {
    return buildIntradayAxisTicks(sessions);
  }
  const dateKeys = tradingDateKeysForRange(activeRange, points, sessions, timeZone, now);
  const lastIndex = Math.max(dateKeys.length - 1, 0);
  if (activeRange === "5D") {
    return dateKeys.map((_, index) => index);
  }

  if (activeRange === "1M") {
    const ticks = new Set<number>([0, lastIndex]);
    for (let offset = 2; offset < lastIndex; offset += 2) {
      ticks.add(offset);
    }
    return Array.from(ticks).sort((left, right) => left - right);
  }
  if (activeRange === "3M") {
    const ticks = new Set<number>([0, lastIndex]);
    for (let offset = 7; offset < lastIndex; offset += 7) {
      ticks.add(offset);
    }
    return Array.from(ticks).sort((left, right) => left - right);
  }
  if (activeRange === "1Y") {
    const ticks = new Set<number>([0, lastIndex]);
    dateKeys.forEach((dateKey, index) => {
      const previousDateKey = dateKeys[index - 1];
      if (index > 0 && dateKey.slice(0, 7) !== previousDateKey?.slice(0, 7)) {
        ticks.add(index);
      }
    });
    return Array.from(ticks).sort((left, right) => left - right);
  }

  return [];
}

function compactTicks(ticks: number[], maxTicks: number, requiredTicks: number[] = []): number[] {
  if (ticks.length <= maxTicks) {
    return ticks;
  }
  const selected = new Set<number>([ticks[0], ticks[ticks.length - 1], ...requiredTicks.slice(0, Math.max(maxTicks - 2, 0))]);
  for (let index = 1; selected.size < maxTicks && index < maxTicks - 1; index += 1) {
    selected.add(ticks[Math.round((ticks.length - 1) * (index / (maxTicks - 1)))]);
  }
  return Array.from(selected).sort((left, right) => left - right);
}

export function buildCompactChartTicks(
  activeRange: string,
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai",
  maxTicks = 4,
  now = new Date(),
  points: MarketChartPoint[] = []
): number[] {
  const requiredTicks = activeRange === "1D" ? buildIntradayBreakTicks(sessions) : [];
  return compactTicks(buildChartTicks(activeRange, sessions, timeZone, now, points), maxTicks, requiredTicks);
}

export function buildChartBoundaryTicks(
  activeRange: string,
  points: MarketChartPoint[] = [],
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai"
): number[] {
  if (activeRange === "5D") {
    const dateKeys = tradingDateKeysFromPoints(points, sessions, timeZone);
    const dayCount = dateKeys.length || 5;
    return Array.from({ length: Math.max(dayCount - 1, 0) }).map((_, index) => index + 1);
  }
  return [];
}

export function dayBoundaryTicks(points: MarketChartPoint[], timeZone = "Asia/Shanghai"): number[] {
  return points
    .filter((point, index) => index > 0 && timeParts(points[index - 1].timestamp, timeZone).date !== timeParts(point.timestamp, timeZone).date)
    .map((point) => point.time);
}

function isSessionBreak(
  previousPoint: MarketChartPoint | undefined,
  point: MarketChartPoint | undefined,
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai"
): boolean {
  if (!previousPoint || !point || sessions.length < 2) {
    return false;
  }
  const previousParts = timeParts(previousPoint.timestamp, timeZone);
  const currentParts = timeParts(point.timestamp, timeZone);
  if (previousParts.date !== currentParts.date) {
    return false;
  }
  return sessions.some((session, index) => {
    const nextSession = sessions[index + 1];
    return Boolean(nextSession && previousParts.time === session.close && currentParts.time === nextSession.open);
  });
}

function formatAxisTime(
  point: MarketChartPoint | undefined,
  previousPoint: MarketChartPoint | undefined,
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai"
): string {
  if (!point) return "";
  const parts = timeParts(point.timestamp, timeZone);
  const crossedDay = previousPoint ? timeParts(previousPoint.timestamp, timeZone).date !== parts.date : false;
  if (crossedDay || parts.time === "00:00") {
    return String(Number(parts.date.slice(8, 10)));
  }
  if (previousPoint) {
    const prevParts = timeParts(previousPoint.timestamp, timeZone);
    const prevMinutes = prevParts.hour * 60 + prevParts.minute;
    const curMinutes = parts.hour * 60 + parts.minute;
    if (isSessionBreak(previousPoint, point, sessions, timeZone) || (parts.date === prevParts.date && curMinutes - prevMinutes > 60)) {
      return `${prevParts.time}/${parts.time}`;
    }
  }
  return parts.time;
}

export function formatRangeAxisTime(
  point: MarketChartPoint | undefined,
  previousPoint: MarketChartPoint | undefined,
  activeRange: string,
  hasMultipleDays: boolean,
  sessions: TradingSessions = [],
  timeZone = "Asia/Shanghai"
): string {
  if (!point) return "";
  if (!hasMultipleDays) {
    return formatAxisTime(point, previousPoint, sessions, timeZone);
  }
  if (activeRange === "5D") {
    return String(Number(timeParts(point.timestamp, timeZone).date.slice(8, 10)));
  }
  if (activeRange === "1M" || activeRange === "3M") {
    return formatShortDate(point.timestamp, timeZone);
  }
  if (activeRange === "1Y") {
    return monthLabels[Number(timeParts(point.timestamp, timeZone).date.slice(5, 7)) - 1] ?? formatShortDate(point.timestamp, timeZone);
  }
  return formatAxisTime(point, previousPoint, sessions, timeZone);
}

export function formatRangeAxisTick(
  value: number,
  activeRange: string,
  timeZone = "Asia/Shanghai",
  now = new Date(),
  sessions: TradingSessions = [],
  points: MarketChartPoint[] = []
): string {
  if (activeRange === "1D") {
    return formatIntradayAxisTick(value, sessions);
  }
  const dateKeys = tradingDateKeysForRange(activeRange, points, sessions, timeZone, now);
  const dayIndex = Math.min(Math.max(Math.round(value), 0), dateKeys.length - 1);
  const dateKey = dateKeys[dayIndex] ?? dateKeys[dateKeys.length - 1] ?? "";
  if (activeRange === "5D") {
    return String(Number(dateKey.slice(8, 10)));
  }
  if (activeRange === "1M") {
    return `${monthLabelForDateKey(dateKey)} ${Number(dateKey.slice(8, 10))}`;
  }
  if (activeRange === "3M") {
    return `${monthLabelForDateKey(dateKey)}${Number(dateKey.slice(8, 10))}`;
  }
  if (activeRange === "1Y") {
    return monthLabelForDateKey(dateKey);
  }
  return "";
}

export function formatTooltipTime(timestamp: string): string {
  return `${formatShortDate(timestamp)} ${timeParts(timestamp).time} Beijing (UTC+8)`;
}
