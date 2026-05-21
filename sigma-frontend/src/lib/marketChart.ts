import type { MarketIndex } from "@/lib/types";

export const marketChartRanges = ["1D", "5D", "1M", "3M", "1Y"] as const;

export type MarketChartRange = (typeof marketChartRanges)[number];

export interface MarketChartPoint {
  time: number;
  timestamp: string;
  value: number;
}

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const warnedChartFallbacks = new Set<string>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

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

function generateRangeChartData(activeRange: string, value: number, positive: boolean, label = "market index"): MarketChartPoint[] {
  const pointCounts: Record<string, number> = { "5D": 5, "1M": 22, "3M": 66, "1Y": 252 };
  const points = pointCounts[activeRange] ?? 22;
  warnChartFallback(
    `${label}-${activeRange}`,
    `SIGMA is displaying generated fallback ${activeRange} chart data for ${label} because the API response did not include a usable historical sparkline.`
  );
  const end = new Date();
  let currentDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 8, 0, 0));
  const dates: Date[] = [];
  while (dates.length < points) {
    if (currentDate.getUTCDay() !== 0 && currentDate.getUTCDay() !== 6) {
      dates.push(new Date(currentDate));
    }
    currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
  }
  dates.reverse();

  const start = positive ? value * 0.985 : value * 1.015;
  return dates.map((date, index) => {
    const progress = points <= 1 ? 1 : index / (points - 1);
    const wave = Math.sin(progress * Math.PI * 4) * value * 0.003;
    const pointValue = start + (value - start) * progress + wave;
    return { time: index, timestamp: date.toISOString(), value: Math.round(pointValue * 100) / 100 };
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

export function toMarketChartData(index: MarketIndex, activeRange = "1D"): MarketChartPoint[] {
  if (activeRange !== "1D") {
    const range = index.sparkline_ranges?.[activeRange];
    const rangeValues = range?.values ?? [];
    const rangeTimes = range?.times ?? [];
    if (rangeValues.length > 0 && rangeTimes.length === rangeValues.length) {
      return rangeValues.map((point, pointIndex) => ({ time: pointIndex, timestamp: rangeTimes[pointIndex], value: point }));
    }
    return generateRangeChartData(activeRange, index.value || 100, index.change_pct >= 0, index.symbol);
  }

  const sparkline = index.sparkline_24h;
  const timestamps = index.sparkline_times ?? [];
  if (sparkline.length > 0 && timestamps.length === sparkline.length) {
    return sparkline.map((point, pointIndex) => ({ time: pointIndex, timestamp: timestamps[pointIndex], value: point }));
  }
  return generateChartData(60, index.value || 100, index.change_pct >= 0, index.symbol);
}

export function toMarketChartDataByRange(index: MarketIndex): Record<string, MarketChartPoint[]> {
  return Object.fromEntries(marketChartRanges.map((range) => [range, toMarketChartData(index, range)]));
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

export function spansMultipleDays(points: MarketChartPoint[], timeZone = "Asia/Shanghai"): boolean {
  return new Set(points.map((point) => timeParts(point.timestamp, timeZone).date)).size > 1;
}

function isSessionBreak(
  previousPoint: MarketChartPoint | undefined,
  point: MarketChartPoint | undefined,
  sessions: MarketIndex["trading_hours"]["sessions"] = [],
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

function buildIntradayChartTicks(
  points: MarketChartPoint[],
  sessions: MarketIndex["trading_hours"]["sessions"] = [],
  timeZone = "Asia/Shanghai"
): number[] {
  if (points.length === 0) {
    return [];
  }
  const ticks = new Set<number>([0, points.length - 1]);
  points.forEach((point, index) => {
    if (index > 0) {
      const previousPoint = points[index - 1];
      const prev = timeParts(previousPoint.timestamp, timeZone);
      const cur = timeParts(point.timestamp, timeZone);
      const prevMin = prev.hour * 60 + prev.minute;
      const curMin = cur.hour * 60 + cur.minute;
      if (isSessionBreak(previousPoint, point, sessions, timeZone) || (prev.date === cur.date && curMin - prevMin > 60)) {
        ticks.add(point.time);
        ticks.delete(previousPoint.time);
      }
    }
    const { minute } = timeParts(point.timestamp, timeZone);
    if (minute === 0 || minute === 30) {
      ticks.add(point.time);
    }
  });
  return Array.from(ticks).sort((left, right) => left - right);
}

function buildMultiDayChartTicks(points: MarketChartPoint[], activeRange: string, timeZone = "Asia/Shanghai"): number[] {
  const ticks = new Set<number>([points[0].time]);
  let tradingDayIndex = 0;

  points.forEach((point, index) => {
    if (index === 0) {
      return;
    }

    const prev = timeParts(points[index - 1].timestamp, timeZone);
    const cur = timeParts(point.timestamp, timeZone);
    if (prev.date === cur.date) {
      return;
    }

    tradingDayIndex += 1;
    const curMonth = cur.date.slice(5, 7);
    const prevMonth = prev.date.slice(5, 7);

    if (activeRange === "5D") {
      ticks.add(point.time);
    } else if (activeRange === "1M" && tradingDayIndex % 3 === 0) {
      ticks.add(point.time);
    } else if (activeRange === "3M" && tradingDayIndex % 10 === 0) {
      ticks.add(point.time);
    } else if (activeRange === "1Y" && curMonth !== prevMonth) {
      ticks.add(point.time);
    }
  });

  return Array.from(ticks).sort((left, right) => left - right);
}

export function buildChartTicks(
  points: MarketChartPoint[],
  activeRange: string,
  sessions: MarketIndex["trading_hours"]["sessions"] = [],
  timeZone = "Asia/Shanghai"
): number[] {
  if (points.length === 0) {
    return [];
  }
  if (activeRange === "1D" || !spansMultipleDays(points, timeZone)) {
    return buildIntradayChartTicks(points, sessions, timeZone);
  }
  return buildMultiDayChartTicks(points, activeRange, timeZone);
}

function compactTicks(ticks: number[], maxTicks: number): number[] {
  if (ticks.length <= maxTicks) {
    return ticks;
  }
  const selected = new Set<number>([ticks[0], ticks[ticks.length - 1]]);
  for (let index = 1; selected.size < maxTicks && index < maxTicks - 1; index += 1) {
    selected.add(ticks[Math.round((ticks.length - 1) * (index / (maxTicks - 1)))]);
  }
  return Array.from(selected).sort((left, right) => left - right);
}

export function buildCompactChartTicks(
  points: MarketChartPoint[],
  activeRange: string,
  sessions: MarketIndex["trading_hours"]["sessions"] = [],
  timeZone = "Asia/Shanghai",
  maxTicks = 4
): number[] {
  return compactTicks(buildChartTicks(points, activeRange, sessions, timeZone), maxTicks);
}

export function dayBoundaryTicks(points: MarketChartPoint[], timeZone = "Asia/Shanghai"): number[] {
  return points
    .filter((point, index) => index > 0 && timeParts(points[index - 1].timestamp, timeZone).date !== timeParts(point.timestamp, timeZone).date)
    .map((point) => point.time);
}

function formatAxisTime(
  point: MarketChartPoint | undefined,
  previousPoint: MarketChartPoint | undefined,
  sessions: MarketIndex["trading_hours"]["sessions"] = [],
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
  sessions: MarketIndex["trading_hours"]["sessions"] = [],
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

export function formatTooltipTime(timestamp: string): string {
  return `${formatShortDate(timestamp)} ${timeParts(timestamp).time} Beijing (UTC+8)`;
}
