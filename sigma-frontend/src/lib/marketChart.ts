import { isPreMarketClearWindow, isTradingHoursActive } from "@/lib/marketSessions";
import type { MarketIndex } from "@/lib/types";

import {
  chartTradingSessions,
  intradayPointPosition,
  isWeekdayDateKey,
  latestAxisDateKey,
  sessionDateKey,
  tradingDateKeysFromPoints,
  tradingDayPosition
} from "./marketChartTime";

export {
  formatShortDate,
  spansMultipleDays,
  timeParts
} from "./marketChartTime";
export {
  buildChartBoundaryTicks,
  buildChartTicks,
  buildChartXAxisDomain,
  buildCompactChartTicks,
  dayBoundaryTicks,
  formatRangeAxisTick,
  formatRangeAxisTime,
  formatTooltipTime
} from "./marketChartTicks";

export const marketChartRanges = ["1D", "5D", "1M", "3M", "1Y"] as const;

export type MarketChartRange = (typeof marketChartRanges)[number];
export type MarketChartAxisDomain = [number, number];

export interface MarketChartPoint {
  time: number;
  timestamp: string;
  value: number;
}

interface ActiveRangeChangeInput {
  activeRange: string;
  chartData: MarketChartPoint[];
  currentValue: number;
  fallbackChangePct: number;
  previousClose: number;
}

export function calculateActiveRangeChange({
  activeRange,
  chartData,
  currentValue,
  fallbackChangePct,
  previousClose
}: ActiveRangeChangeInput): {
  changePct: number;
  changeSign: string;
  isPositive: boolean;
  pointChange: number;
  rangeStartValue: number;
} {
  const rangeStartValue =
    activeRange === "1D" || chartData.length === 0
      ? previousClose
      : chartData[0].value;
  const pointChange = currentValue - rangeStartValue;
  const changePct =
    rangeStartValue > 0
      ? (pointChange / rangeStartValue) * 100
      : fallbackChangePct;
  const isPositive = changePct >= 0;
  const changeSign = isPositive ? "+" : "";

  return {
    changePct,
    changeSign,
    isPositive,
    pointChange,
    rangeStartValue
  };
}

export function toIntradayChartData(index: MarketIndex, now = new Date(), clearPreMarket = true): MarketChartPoint[] {
  if (clearPreMarket && isPreMarketClearWindow(index.trading_hours, now)) {
    return [];
  }

  const chartSessions = chartTradingSessions(index);
  const chartTimeZone = "Asia/Shanghai";
  const isTrading = index.is_trading || isTradingHoursActive(index.trading_hours, now);
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
      if (isTrading && dateKey !== currentDateKey) {
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
    if (points.length > 0 || !isTrading) {
      return points;
    }
  }

  return [];
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
      : [];
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
      : [];
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
