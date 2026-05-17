"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { TooltipProps } from "recharts";

import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import { cn } from "@/lib/cn";
import type { MarketIndex } from "@/lib/types";

const indexSymbols = ["SPX", "IXIC", "SSE", "N225", "FTSE", "DAX", "HSI"] as const;
const ranges = ["1d", "5d", "1m", "6m", "1y", "all"] as const;
const localeOrder = {
  zh: ["SSE", "HSI", "N225", "SPX", "IXIC", "FTSE", "DAX"],
  en: ["SPX", "IXIC", "FTSE", "DAX", "N225", "SSE", "HSI"]
} as const;

type RangeId = (typeof ranges)[number];

interface ChartPoint {
  label: string;
  timestamp: string;
  value: number;
}

export function MarketIndexChart() {
  const locale = useLocale() as "zh" | "en";
  const t = useTranslations("feed.chart");
  const { data, isLoading } = useMarketIndices();
  const [activeSymbol, setActiveSymbol] = useState("SPX");
  const [range, setRange] = useState<RangeId>("1d");
  const [autoRotate, setAutoRotate] = useState(true);
  const resumeTimerRef = useRef<number | null>(null);
  const ordered = useMemo(() => orderIndices(data?.indices ?? [], locale), [data?.indices, locale]);
  const activeIndex = ordered.find((index) => index.symbol === activeSymbol) ?? ordered[0] ?? null;

  useEffect(() => {
    if (!activeIndex && ordered[0]) {
      setActiveSymbol(ordered[0].symbol);
    }
  }, [activeIndex, ordered]);

  useEffect(() => {
    if (!autoRotate || ordered.length <= 1) {
      return;
    }
    const interval = window.setInterval(() => {
      setActiveSymbol((current) => {
        const currentIndex = ordered.findIndex((index) => index.symbol === current);
        return ordered[(currentIndex + 1) % ordered.length]?.symbol ?? ordered[0].symbol;
      });
    }, 8000);
    return () => window.clearInterval(interval);
  }, [autoRotate, ordered]);

  function handleManualSelect(symbol: string) {
    setActiveSymbol(symbol);
    setAutoRotate(false);
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => setAutoRotate(true), 15_000);
  }

  const chartData = useMemo(() => (activeIndex ? buildChartData(activeIndex, range) : []), [activeIndex, range]);
  const domain = useMemo(() => yDomain(chartData), [chartData]);
  const positive = (activeIndex?.change_pct ?? 0) >= 0;
  const lineColor = positive ? "rgb(var(--sigma-success))" : "rgb(var(--sigma-danger))";

  return (
    <section className="rounded-2xl border border-sigma-line bg-sigma-surface p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
          {isLoading
            ? null
            : ordered.map((index) => (
                <button
                  className={cn(
                    "h-8 shrink-0 snap-start rounded-full px-3 text-xs font-semibold",
                    activeIndex?.symbol === index.symbol
                      ? "bg-sigma-text text-sigma-bg"
                      : "border border-sigma-line text-sigma-muted hover:text-sigma-text"
                  )}
                  key={index.symbol}
                  onClick={() => handleManualSelect(index.symbol)}
                  type="button"
                >
                  {shortIndexName(index)}
                </button>
              ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ranges.map((item) => (
            <button
              className={cn(
                "h-7 rounded-full px-2.5 text-xs font-semibold",
                range === item
                  ? "bg-sigma-text text-sigma-bg"
                  : "border border-sigma-line text-sigma-muted hover:text-sigma-text"
              )}
              key={item}
              onClick={() => setRange(item)}
              type="button"
            >
              {t(`ranges.${item}`)}
            </button>
          ))}
          <div className="ml-1 flex items-center gap-2 text-xs font-semibold text-sigma-muted">
            <ToggleSwitch checked={autoRotate} label={t("autoRotate")} onChange={setAutoRotate} />
            {t("autoRotate")}
          </div>
        </div>
      </div>

      <div className="mt-3 h-[180px] md:h-[300px]">
        {activeIndex ? (
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={chartData} margin={{ bottom: 8, left: 0, right: 10, top: 12 }}>
              <defs>
                <linearGradient id={`index-fill-${activeIndex.symbol}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                axisLine={false}
                dataKey="label"
                interval="preserveStartEnd"
                tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={domain}
                orientation="left"
                tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }}
                tickFormatter={(value: number) => value.toLocaleString(locale, { maximumFractionDigits: 0 })}
                tickLine={false}
                width={60}
              />
              <Tooltip
                content={<CustomTooltip locale={locale} lineColor={lineColor} timeZone={activeIndex.trading_hours.timezone} />}
                cursor={<CustomCursor />}
                wrapperStyle={{ pointerEvents: "none" }}
              />
              <Area
                activeDot={{ fill: lineColor, r: 4, stroke: "rgb(var(--sigma-bg))", strokeWidth: 2 }}
                dataKey="value"
                fill={`url(#index-fill-${activeIndex.symbol})`}
                isAnimationActive={false}
                stroke={lineColor}
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-sigma-muted">{t("empty")}</div>
        )}
      </div>
    </section>
  );
}

function orderIndices(indices: MarketIndex[], locale: "zh" | "en") {
  const priority = localeOrder[locale];
  return indices
    .filter((index) => indexSymbols.includes(index.symbol as (typeof indexSymbols)[number]))
    .sort((left, right) => {
      if (left.is_trading !== right.is_trading) {
        return left.is_trading ? -1 : 1;
      }
      return symbolRank(priority, left.symbol) - symbolRank(priority, right.symbol);
    });
}

function symbolRank(priority: readonly string[], symbol: string) {
  const index = priority.indexOf(symbol);
  return index === -1 ? priority.length : index;
}

function shortIndexName(index: MarketIndex) {
  if (index.symbol === "SPX") {
    return "S&P";
  }
  if (index.symbol === "IXIC") {
    return "Nasdaq";
  }
  if (index.symbol === "N225") {
    return "Nikkei";
  }
  return index.symbol;
}

function buildChartData(index: MarketIndex, range: RangeId): ChartPoint[] {
  const now = new Date();
  const points = expandSparkline(index.sparkline_24h, range);
  return points.map((value, pointIndex) => {
    const timestamp = timestampForRange(now, range, pointIndex, points.length);
    return {
      label: labelForRange(timestamp, range),
      timestamp: timestamp.toISOString(),
      value
    };
  });
}

function expandSparkline(values: number[], range: RangeId): number[] {
  const multiplier = range === "1d" ? 1 : range === "5d" ? 2 : range === "1m" ? 3 : range === "6m" ? 4 : 5;
  const source = values.length >= 2 ? values : [100, 101];
  const expanded: number[] = [];
  for (let cycle = 0; cycle < multiplier; cycle += 1) {
    const drift = (cycle - multiplier + 1) * source[source.length - 1] * 0.002;
    expanded.push(...source.map((value) => Number((value + drift).toFixed(2))));
  }
  return expanded;
}

function timestampForRange(now: Date, range: RangeId, index: number, total: number) {
  const spanHours = range === "1d" ? 24 : range === "5d" ? 24 * 5 : range === "1m" ? 24 * 30 : range === "6m" ? 24 * 183 : range === "1y" ? 24 * 365 : 24 * 365 * 5;
  const offsetMs = ((total - 1 - index) / Math.max(total - 1, 1)) * spanHours * 60 * 60 * 1000;
  return new Date(now.getTime() - offsetMs);
}

function labelForRange(date: Date, range: RangeId) {
  if (range === "1d") {
    return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  if (range === "5d") {
    return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

function yDomain(data: ChartPoint[]): [number, number] {
  if (data.length === 0) {
    return [0, 1];
  }
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.08, max * 0.005);
  return [Number((min - padding).toFixed(2)), Number((max + padding).toFixed(2))];
}

function CustomCursor({ height = 0, points }: { height?: number; points?: Array<{ x: number; y: number }> }) {
  const x = points?.[0]?.x;
  if (x === undefined) {
    return null;
  }
  return <line stroke="rgb(var(--sigma-text))" strokeDasharray="3 3" strokeWidth={0.5} x1={x} x2={x} y1={0} y2={height} />;
}

function CustomTooltip({
  active,
  coordinate,
  label,
  lineColor,
  locale,
  payload,
  timeZone
}: TooltipProps<number, string> & { lineColor: string; locale: string; timeZone: string }) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !point) {
    return null;
  }
  const date = new Date(point.timestamp);
  const offset = timezoneOffset(date, timeZone);
  const flipRight = (coordinate?.x ?? 0) < 100;

  return (
    <div
      className="min-w-[90px] rounded-lg px-3.5 py-2 text-center shadow-apple-soft"
      style={{
        background: "rgb(10, 10, 10)",
        borderTop: `2px solid ${lineColor}`,
        transform: flipRight ? "translate(16px, -50%)" : "translate(-105px, -50%)"
      }}
    >
      <p className="text-[15px] font-medium text-white">{point.value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <p className="mt-1 text-[11px] text-[#aaaaaa]">
        {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "2-digit" }).format(date)}
      </p>
      <p className="text-[11px] text-[#aaaaaa]">
        {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(date)} {offset}
      </p>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function timezoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
    timeZoneName: "shortOffset"
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "UTC";
  return name.replace("GMT", "UTC");
}
