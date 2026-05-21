"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useMarketIndices } from "@/hooks/useMarketIndices";
import type { MarketIndex } from "@/lib/types";
import { cn } from "@/lib/utils";

const INDEX_ICONS: Record<string, { letter: string; bg: string; text: string }> = {
  SPX: { letter: "S&P", bg: "bg-red-500", text: "text-white" },
  IXIC: { letter: "NQ", bg: "bg-blue-500", text: "text-white" },
  DJI: { letter: "DJ", bg: "bg-blue-700", text: "text-white" },
  SSE: { letter: "SSE", bg: "bg-red-600", text: "text-yellow-300" },
  HSI: { letter: "HS", bg: "bg-teal-600", text: "text-white" },
  N225: { letter: "N225", bg: "bg-rose-600", text: "text-white" },
  FTSE: { letter: "FT", bg: "bg-blue-800", text: "text-white" },
  DAX: { letter: "DAX", bg: "bg-yellow-500", text: "text-black" },
  KOSPI: { letter: "KS", bg: "bg-blue-600", text: "text-white" },
  TAIEX: { letter: "TW", bg: "bg-green-600", text: "text-white" }
};

const timeRanges = ["1D", "5D", "1M", "3M", "1Y"];
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ChartPoint {
  time: number;
  timestamp: string;
  value: number;
}

interface MarketChartData {
  change: number;
  data: ChartPoint[];
  name: string;
  price: number;
  symbol: string;
  currency: string;
  tradingHours: MarketIndex["trading_hours"];
}

function generateChartData(points: number, value: number, positive: boolean): ChartPoint[] {
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

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

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

function toChartData(index: MarketIndex): ChartPoint[] {
  const sparkline = index.sparkline_24h;
  const timestamps = index.sparkline_times ?? [];
  if (sparkline.length > 1 && timestamps.length === sparkline.length) {
    return sparkline.map((point, pointIndex) => ({ time: pointIndex, timestamp: timestamps[pointIndex], value: point }));
  }
  return generateChartData(60, index.value || 100, index.change_pct >= 0);
}

function timeParts(timestamp: string, timeZone = "Asia/Shanghai"): { date: string; hour: number; minute: number; time: string } {
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

function formatShortDate(timestamp: string, timeZone = "Asia/Shanghai"): string {
  const parts = timeParts(timestamp, timeZone);
  const month = Number(parts.date.slice(5, 7));
  const day = Number(parts.date.slice(8, 10));
  return `${month}/${day}`;
}

function spansMultipleDays(points: ChartPoint[], timeZone = "Asia/Shanghai"): boolean {
  return new Set(points.map((point) => timeParts(point.timestamp, timeZone).date)).size > 1;
}

function isSessionBreak(
  previousPoint: ChartPoint | undefined,
  point: ChartPoint | undefined,
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
  points: ChartPoint[],
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

function buildMultiDayChartTicks(points: ChartPoint[], activeRange: string, timeZone = "Asia/Shanghai"): number[] {
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

function buildChartTicks(
  points: ChartPoint[],
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

function dayBoundaryTicks(points: ChartPoint[], timeZone = "Asia/Shanghai"): number[] {
  return points
    .filter((point, index) => index > 0 && timeParts(points[index - 1].timestamp, timeZone).date !== timeParts(point.timestamp, timeZone).date)
    .map((point) => point.time);
}

function formatAxisTime(
  point: ChartPoint | undefined,
  previousPoint: ChartPoint | undefined,
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

function formatRangeAxisTime(
  point: ChartPoint | undefined,
  previousPoint: ChartPoint | undefined,
  activeRange: string,
  hasMultipleDays: boolean,
  sessions: MarketIndex["trading_hours"]["sessions"] = [],
  timeZone = "Asia/Shanghai"
): string {
  if (!point) return "";
  if (!hasMultipleDays) {
    return formatAxisTime(point, previousPoint, sessions, timeZone);
  }
  if (activeRange === "5D" || activeRange === "1M") {
    return String(Number(timeParts(point.timestamp, timeZone).date.slice(8, 10)));
  }
  if (activeRange === "3M") {
    return formatShortDate(point.timestamp, timeZone);
  }
  if (activeRange === "1Y") {
    return monthLabels[Number(timeParts(point.timestamp, timeZone).date.slice(5, 7)) - 1] ?? formatShortDate(point.timestamp, timeZone);
  }
  return formatAxisTime(point, previousPoint, sessions, timeZone);
}

function formatTooltipTime(timestamp: string): string {
  return `${formatShortDate(timestamp)} ${timeParts(timestamp).time} Beijing (UTC+8)`;
}

export function HeroChart() {
  const t = useTranslations("dashboard");
  const { data, isLoading } = useMarketIndices();
  const markets = useMemo<MarketChartData[]>(() => {
    const indices = data?.indices ?? [];
    if (indices.length === 0) {
      return [
        {
          change: 0,
          data: generateChartData(60, 100, true),
          name: "SIGMA",
          price: 100,
          symbol: "SIGMA",
          currency: "USD",
          tradingHours: {
            close: "16:00",
            open: "09:30",
            sessions: [{ close: "16:00", open: "09:30" }],
            timezone: "Asia/Shanghai"
          }
        }
      ];
    }

    return indices.map((index) => ({
      change: index.change_pct,
      data: toChartData(index),
      name: index.name,
      price: index.value,
      symbol: index.symbol,
      currency: index.currency,
      tradingHours: index.trading_hours
    }));
  }, [data]);
  const [activeMarket, setActiveMarket] = useState(markets[0]?.name ?? "SIGMA");
  const [activeRange, setActiveRange] = useState("1D");
  const [direction, setDirection] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);

  useEffect(() => {
    if (!markets.some((market) => market.name === activeMarket)) {
      setActiveMarket(markets[0]?.name ?? "SIGMA");
    }
  }, [activeMarket, markets]);

  const currentData = markets.find((market) => market.name === activeMarket) ?? markets[0];
  const isPositive = (currentData?.change ?? 0) >= 0;
  const chartData = currentData?.data ?? [];
  const chartSessions = currentData?.tradingHours.sessions ?? [];
  const chartTimeZone = currentData?.tradingHours.timezone ?? "Asia/Shanghai";
  const chartTicks = useMemo(
    () => buildChartTicks(chartData, activeRange, chartSessions, chartTimeZone),
    [activeRange, chartData, chartSessions, chartTimeZone]
  );
  const chartHasMultipleDays = useMemo(() => spansMultipleDays(chartData, chartTimeZone), [chartData, chartTimeZone]);
  const boundaryTicks = useMemo(() => dayBoundaryTicks(chartData, chartTimeZone), [chartData, chartTimeZone]);

  const handlePrev = () => {
    const currentIndex = markets.findIndex((market) => market.name === activeMarket);
    const prevIndex = (currentIndex - 1 + markets.length) % markets.length;
    setDirection(-1);
    setActiveMarket(markets[prevIndex]?.name ?? activeMarket);
  };

  const handleNext = () => {
    const currentIndex = markets.findIndex((market) => market.name === activeMarket);
    const nextIndex = (currentIndex + 1) % markets.length;
    setDirection(1);
    setActiveMarket(markets[nextIndex]?.name ?? activeMarket);
  };

  const handleDragEnd = (_event: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(velocity) > 500 || Math.abs(offset) > threshold) {
      if (offset > 0 || velocity > 500) {
        handlePrev();
      } else {
        handleNext();
      }
    }

    animate(dragX, 0, { damping: 30, stiffness: 300, type: "spring" });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") handlePrev();
      if (event.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const chartOpacity = useTransform(dragX, [-100, 0, 100], [0.5, 1, 0.5]);

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 lg:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-4">
            <div className="h-7 w-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="h-10 w-36 animate-pulse rounded-lg bg-muted" />
            <div className="ml-auto h-5 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-56 animate-pulse rounded-xl bg-muted/60 lg:h-72" />
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 lg:p-8">
      <div
        className={cn(
          "absolute inset-0 opacity-5 transition-opacity duration-500",
          isPositive ? "bg-gradient-to-br from-chart-1 to-transparent" : "bg-gradient-to-br from-chart-2 to-transparent"
        )}
      />

      <div className="relative z-10 mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
              {currentData?.symbol}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-chart-1/10 px-2.5 py-1 text-xs text-chart-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-chart-1" />
              {t("live")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                INDEX_ICONS[currentData?.symbol ?? ""]?.bg ?? "bg-primary",
                INDEX_ICONS[currentData?.symbol ?? ""]?.text ?? "text-primary-foreground"
              )}
            >
              {INDEX_ICONS[currentData?.symbol ?? ""]?.letter ?? currentData?.symbol?.slice(0, 2)}
            </div>
            <motion.h2
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-foreground lg:text-3xl"
              initial={{ opacity: 0, y: 10 }}
              key={activeMarket}
            >
              {currentData?.name}
            </motion.h2>
          </div>
        </div>

        <div className="text-right">
          <motion.p
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-baseline gap-2 text-3xl font-bold tracking-normal text-foreground lg:text-4xl"
            initial={{ opacity: 0, scale: 0.95 }}
            key={`${activeMarket}-price`}
          >
            <span className="text-lg font-semibold text-muted-foreground lg:text-xl">
              {currentData?.currency}
            </span>
            {currentData?.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </motion.p>
          <motion.div
            animate={{ opacity: 1 }}
            className={cn(
              "mt-1 flex items-center justify-end gap-1.5 text-base font-semibold",
              isPositive ? "text-chart-1" : "text-chart-2"
            )}
            initial={{ opacity: 0 }}
            key={`${activeMarket}-change`}
          >
            {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            <span>
              {isPositive ? "+" : ""}
              {currentData?.change.toFixed(2)}%
            </span>
          </motion.div>
        </div>
      </div>

      <button
        aria-label="Previous market"
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2.5 text-foreground opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-muted group-hover:opacity-100"
        onClick={handlePrev}
        type="button"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        aria-label="Next market"
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2.5 text-foreground opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-muted group-hover:opacity-100"
        onClick={handleNext}
        type="button"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <motion.div
        className="relative h-56 cursor-grab touch-pan-y active:cursor-grabbing lg:h-72"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(event, info) => {
          setIsDragging(false);
          handleDragEnd(event as PointerEvent, info);
        }}
        onDragStart={() => setIsDragging(true)}
        ref={containerRef}
        style={{ x: dragX }}
      >
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="absolute inset-0"
            exit={{ opacity: 0, x: direction * -80 }}
            initial={{ opacity: 0, x: direction * 80 }}
            key={activeMarket}
            style={{ opacity: isDragging ? chartOpacity : 1 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={currentData?.data ?? []} margin={{ bottom: 4, left: 30, right: 30, top: 10 }}>
                <defs>
                  <linearGradient id="colorPositive" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNegative" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  axisLine={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.28 }}
                  dataKey="time"
                  interval={0}
                  minTickGap={0}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value) => {
                    const pointIndex = Number(value);
                    return formatRangeAxisTime(
                      chartData[pointIndex],
                      chartData[pointIndex - 1],
                      activeRange,
                      chartHasMultipleDays,
                      chartSessions,
                      chartTimeZone
                    );
                  }}
                  tickLine={false}
                  tickMargin={8}
                  ticks={chartTicks}
                />
                <YAxis axisLine={false} domain={["dataMin - 10", "dataMax + 10"]} hide tickLine={false} />
                {boundaryTicks.map((tick) => (
                  <ReferenceLine
                    ifOverflow="extendDomain"
                    key={tick}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="3 5"
                    strokeOpacity={0.24}
                    x={tick}
                  />
                ))}
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const timestamp = String(payload[0].payload?.timestamp ?? "");
                      return (
                        <div className="rounded-xl bg-foreground px-4 py-3 text-background shadow-xl dark:border dark:border-border dark:bg-card dark:text-card-foreground">
                          <p className="text-base font-bold">
                            {Number(payload[0].value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="mt-1 text-xs font-medium text-background/70 dark:text-muted-foreground">
                            {formatTooltipTime(timestamp)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  animationDuration={800}
                  dataKey="value"
                  fill={isPositive ? "url(#colorPositive)" : "url(#colorNegative)"}
                  stroke={isPositive ? "oklch(0.65 0.22 145)" : "oklch(0.6 0.22 25)"}
                  strokeWidth={2.5}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>

      </motion.div>

      <div className="mb-2 mt-4 flex items-center justify-center gap-2">
        {markets.map((market) => (
          <button
            aria-label={market.name}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              activeMarket === market.name ? "w-8 bg-primary" : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
            )}
            key={market.name}
            onClick={() => {
              setDirection(markets.findIndex((item) => item.name === market.name) > markets.findIndex((item) => item.name === activeMarket) ? 1 : -1);
              setActiveMarket(market.name);
            }}
            type="button"
          />
        ))}
      </div>

      <div className="mx-auto flex max-w-fit items-center justify-center gap-1 rounded-xl bg-muted/50 p-1.5">
        {timeRanges.map((range) => (
          <button
            className={cn(
              "relative rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200",
              activeRange === range ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            key={range}
            onClick={() => setActiveRange(range)}
            type="button"
          >
            {activeRange === range ? (
              <motion.div
                className="absolute inset-0 rounded-lg border border-border bg-card shadow-md"
                layoutId="heroTimeRange"
                transition={{ damping: 35, mass: 0.8, stiffness: 500, type: "spring" }}
              />
            ) : null}
            <span className="relative z-10">{range}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
