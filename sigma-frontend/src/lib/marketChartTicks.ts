import type { MarketChartAxisDomain, MarketChartPoint } from "./marketChart";
import {
  buildIntradayAxisTicks,
  buildIntradayBreakTicks,
  fallbackTradingDateKeys,
  formatIntradayAxisTick,
  formatShortDate,
  intradayAxisBounds,
  monthLabelForDateKey,
  monthLabels,
  timeParts,
  tradingDateKeysForRange,
  tradingDateKeysFromPoints
} from "./marketChartTime";
import type { TradingSessions } from "./marketChartTime";

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
  ...[
    activeRange,
    sessions = [],
    timeZone = "Asia/Shanghai",
    now = new Date(),
    points = []
  ]: [string, TradingSessions?, string?, Date?, MarketChartPoint[]?]
): number[] {
  if (activeRange === "1D") {
    return buildIntradayAxisTicks(sessions);
  }
  const dateKeys = tradingDateKeysForRange({ activeRange, points, sessions, timeZone, now });
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
  ...[
    activeRange,
    sessions = [],
    timeZone = "Asia/Shanghai",
    maxTicks = 4,
    now = new Date(),
    points = []
  ]: [string, TradingSessions?, string?, number?, Date?, MarketChartPoint[]?]
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
  ...[
    point,
    previousPoint,
    activeRange,
    hasMultipleDays,
    sessions = [],
    timeZone = "Asia/Shanghai"
  ]: [MarketChartPoint | undefined, MarketChartPoint | undefined, string, boolean, TradingSessions?, string?]
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
  ...[
    value,
    activeRange,
    timeZone = "Asia/Shanghai",
    now = new Date(),
    sessions = [],
    points = []
  ]: [number, string, string?, Date?, TradingSessions?, MarketChartPoint[]?]
): string {
  if (activeRange === "1D") {
    return formatIntradayAxisTick(value, sessions);
  }
  const dateKeys = tradingDateKeysForRange({ activeRange, points, sessions, timeZone, now });
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
