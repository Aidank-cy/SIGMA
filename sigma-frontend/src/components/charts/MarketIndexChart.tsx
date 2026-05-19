"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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

const indexSymbols = ["SPX", "IXIC", "SSE", "N225", "FTSE", "DAX", "HSI", "DJI"] as const;
const majorIndexSymbols = ["IXIC", "N225", "SSE", "FTSE", "DAX", "CAC"] as const;
const ranges = ["1d", "3d", "7d", "15d", "30d", "90d", "180d", "1y", "5y", "10y"] as const;
const chartTimeZone = "Asia/Shanghai";
const axisReference = { day: 15, month: 5, year: 2026 };
const rangeDays: Record<RangeId, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "15d": 15,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "1y": 365,
  "5y": 365 * 5,
  "10y": 365 * 10
};

const marketBreaks: Record<string, Array<{ start: string; end: string }>> = {
  HSI: [{ start: "12:00", end: "13:00" }],
  N225: [{ start: "11:30", end: "12:30" }],
  SSE: [{ start: "11:30", end: "13:00" }]
};

const localeOrder = {
  zh: ["SSE", "HSI", "N225", "SPX", "IXIC", "FTSE", "DAX", "DJI"],
  en: ["SPX", "IXIC", "FTSE", "DAX", "N225", "SSE", "HSI", "DJI"]
} as const;

const indexMeta: Record<string, { displayName: string; shortTicker: string; iconLabel: string; currency: string }> = {
  SPX: { displayName: "S&P 500", shortTicker: "SPX", iconLabel: "500", currency: "USD" },
  IXIC: { displayName: "Nasdaq 100", shortTicker: "NDX", iconLabel: "100", currency: "USD" },
  DJI: { displayName: "Dow Jones", shortTicker: "DJI", iconLabel: "30", currency: "USD" },
  N225: { displayName: "Japan 225", shortTicker: "NI225", iconLabel: "225", currency: "JPY" },
  SSE: { displayName: "SSE Composite", shortTicker: "000001", iconLabel: "", currency: "CNY" },
  HSI: { displayName: "Hang Seng", shortTicker: "HSI", iconLabel: "", currency: "HKD" },
  FTSE: { displayName: "FTSE 100", shortTicker: "UKX", iconLabel: "100", currency: "GBP" },
  DAX: { displayName: "DAX", shortTicker: "DAX", iconLabel: "X", currency: "EUR" },
  CAC: { displayName: "CAC 40", shortTicker: "PX1", iconLabel: "40", currency: "EUR" }
};

const iconClasses: Record<string, string> = {
  SPX: "bg-red-600",
  IXIC: "bg-blue-600",
  DJI: "bg-slate-800",
  N225: "bg-red-600",
  SSE: "bg-teal-600",
  HSI: "bg-emerald-600",
  FTSE: "bg-slate-950",
  DAX: "bg-zinc-900",
  CAC: "bg-sky-600"
};

const currencyMap: Record<string, string> = {
  SPX: "USD",
  IXIC: "USD",
  DJI: "USD",
  SSE: "CNY",
  HSI: "HKD",
  N225: "JPY",
  FTSE: "GBP",
  DAX: "EUR",
  CAC: "EUR"
};

type RangeId = (typeof ranges)[number];
type ChartTranslator = ReturnType<typeof useTranslations>;

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
  const [autoRotate, setAutoRotate] = useState(false);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const resumeTimerRef = useRef<number | null>(null);

  const ordered = useMemo(() => orderIndices(data?.indices ?? [], locale), [data?.indices, locale]);
  const activeIndex = ordered.find((index) => index.symbol === activeSymbol) ?? ordered[0] ?? null;
  const majorIndices = useMemo(() => orderMajorIndices(data?.indices ?? []), [data?.indices]);

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

  useEffect(() => {
    setOpenPopoverId(null);
  }, [activeSymbol]);

  useEffect(() => {
    const close = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-market-popover-root='true']")) {
        return;
      }
      setOpenPopoverId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPopoverId(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  function handleManualSelect(symbol: string) {
    setActiveSymbol(symbol);
    setAutoRotate(false);
    setOpenPopoverId(null);
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => setAutoRotate(true), 15_000);
  }

  function handleStatusClick(event: ReactMouseEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation();
    setOpenPopoverId((current) => (current === id ? null : id));
  }

  const chartData = useMemo(() => (activeIndex ? buildChartData(activeIndex, range) : []), [activeIndex, range]);
  const axisTicks = useMemo(() => chartData.filter((point) => point.label !== "").map((point) => point.timestamp), [chartData]);
  const axisLabels = useMemo(
    () => new Map(chartData.filter((point) => point.label !== "").map((point) => [point.timestamp, point.label])),
    [chartData]
  );
  const domain = useMemo(() => yDomain(chartData), [chartData]);
  const positive = (activeIndex?.change_pct ?? 0) >= 0;
  const lineColor = positive ? "rgb(var(--sigma-success))" : "rgb(var(--sigma-danger))";

  return (
    <section className="rounded-2xl border border-sigma-line bg-sigma-surface">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 p-4 sm:p-5 lg:p-6">
          {activeIndex ? (
            <>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <IndexIdentity
                  index={activeIndex}
                  isOpen={openPopoverId === "main"}
                  locale={locale}
                  onStatusClick={handleStatusClick}
                  t={t}
                />
                <ChartControls autoRotate={autoRotate} range={range} setAutoRotate={setAutoRotate} setRange={setRange} t={t} />
              </div>

              <div className="mt-3 h-[280px] md:h-[380px]">
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart data={chartData} margin={{ top: 16, right: 36, bottom: 6, left: 5 }}>
                    <defs>
                      <linearGradient id={`index-fill-${activeIndex.symbol}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.16} />
                        <stop offset="72%" stopColor={lineColor} stopOpacity={0.04} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      axisLine={false}
                      dataKey="timestamp"
                      interval={0}
                      minTickGap={18}
                      tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }}
                      tickFormatter={(value: unknown) => axisLabels.get(String(value)) ?? ""}
                      tickLine={false}
                      tickMargin={2}
                      ticks={axisTicks}
                    />
                    <YAxis
                      axisLine={false}
                      domain={domain}
                      orientation="left"
                      tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }}
                      tickFormatter={(value: number) => value.toLocaleString(locale, { maximumFractionDigits: 0 })}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      animationDuration={0}
                      content={<CustomTooltip lineColor={lineColor} locale={locale} />}
                      cursor={<CustomCursor />}
                      isAnimationActive={false}
                      wrapperStyle={{ pointerEvents: "none" }}
                    />
                    <Area
                      activeDot={{ fill: lineColor, r: 4, stroke: "rgb(var(--sigma-bg))", strokeWidth: 2 }}
                      dataKey="value"
                      fill={`url(#index-fill-${activeIndex.symbol})`}
                      isAnimationActive={false}
                      stroke={lineColor}
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-sigma-muted">
              {isLoading ? t("loading") : t("empty")}
            </div>
          )}
        </div>

        <aside className="border-t border-sigma-line p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col">
            <h2 className="text-base font-bold text-sigma-text">{t("majorIndices")}</h2>
            <div className="mt-3 flex-1 divide-y divide-sigma-line">
              {majorIndices.map((index) => (
                <MajorIndexRow
                  index={index}
                  isActive={activeIndex?.symbol === index.symbol}
                  isPopoverOpen={openPopoverId === index.symbol}
                  key={index.symbol}
                  locale={locale}
                  onSelect={handleManualSelect}
                  onStatusClick={handleStatusClick}
                  t={t}
                />
              ))}
            </div>
            <a
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sigma-accent hover:opacity-80"
              href="https://www.google.com/finance/"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("seeAllMajorIndices")}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}

function IndexIdentity({
  index,
  isOpen,
  locale,
  onStatusClick,
  t
}: {
  index: MarketIndex;
  isOpen: boolean;
  locale: string;
  onStatusClick: (event: ReactMouseEvent<HTMLButtonElement>, symbol: string) => void;
  t: ChartTranslator;
}) {
  const meta = metaFor(index);
  return (
    <div className="relative flex min-w-0 items-start gap-3">
      <IndexIcon className="h-10 w-10 text-sm" symbol={index.symbol} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-semibold text-sigma-text sm:text-lg">{meta.displayName}</h2>
          <span className="rounded bg-sigma-bg px-1.5 py-0.5 text-xs font-semibold text-sigma-muted">{index.symbol}</span>
          <StatusPopoverControl
            id="main"
            index={index}
            isOpen={isOpen}
            onStatusClick={onStatusClick}
            t={t}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-sigma-text sm:text-3xl">
            {formatValue(index.value, locale)}
          </span>
          <span className="text-sm font-medium text-sigma-muted">{currencyFor(index)}</span>
          <ChangeText change={index.change_pct} />
        </div>
      </div>
    </div>
  );
}

function ChartControls({
  autoRotate,
  range,
  setAutoRotate,
  setRange,
  t
}: {
  autoRotate: boolean;
  range: RangeId;
  setAutoRotate: (value: boolean) => void;
  setRange: (value: RangeId) => void;
  t: ChartTranslator;
}) {
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const selectedLabel = t(`ranges.${range}`);

  function selectRange(value: RangeId) {
    setRange(value);
    setIsRangeOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
      <div className="relative">
        <button
          aria-expanded={isRangeOpen}
          className="inline-flex h-12 items-center gap-2 rounded-2xl border border-sigma-line bg-sigma-elevated px-4 text-sm font-medium text-sigma-text outline-none hover:bg-sigma-elevated/80 focus-visible:border-sigma-accent focus-visible:ring-4 focus-visible:ring-sigma-accent/15"
          onClick={() => setIsRangeOpen((current) => !current)}
          type="button"
        >
          {t("rangeLabel")}
          <span className="rounded-xl bg-sigma-text px-2 py-0.5 text-xs font-semibold text-sigma-bg">
            {selectedLabel}
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-sigma-muted transition-transform", isRangeOpen ? "rotate-180" : "")}
            aria-hidden
          />
        </button>
        {isRangeOpen ? (
          <div className="absolute right-0 top-14 z-30 w-56 origin-top-right rounded-2xl border border-sigma-line bg-sigma-surface p-2 shadow-apple transition duration-150 ease-out">
            <div className="grid grid-cols-4 gap-1">
              {ranges.map((item) => (
                <button
                  className={cn(
                    "h-9 rounded-xl px-2 text-sm font-semibold",
                    range === item
                      ? "bg-sigma-text text-sigma-bg"
                      : "text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                  )}
                  key={item}
                  onClick={() => selectRange(item)}
                  type="button"
                >
                  {t(`ranges.${item}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="ml-1 flex items-center gap-2 text-xs font-semibold text-sigma-muted">
        <ToggleSwitch checked={autoRotate} label={t("autoRotate")} onChange={setAutoRotate} />
        {t("autoRotate")}
      </div>
    </div>
  );
}

function MajorIndexRow({
  index,
  isActive,
  isPopoverOpen,
  locale,
  onSelect,
  onStatusClick,
  t
}: {
  index: MarketIndex;
  isActive: boolean;
  isPopoverOpen: boolean;
  locale: string;
  onSelect: (symbol: string) => void;
  onStatusClick: (event: ReactMouseEvent<HTMLButtonElement>, symbol: string) => void;
  t: ChartTranslator;
}) {
  const meta = metaFor(index);
  return (
    <div className="relative py-2">
      <div
        className={cn(
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-sigma-bg",
          isActive && "bg-sigma-accent/10"
        )}
        onClick={() => onSelect(index.symbol)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(index.symbol);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className="flex min-w-0 items-center gap-3">
          <IndexIcon className="h-9 w-9 text-xs" symbol={index.symbol} />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-sigma-text">{meta.displayName}</span>
              <StatusPopoverControl
                align="right"
                id={index.symbol}
                index={index}
                isOpen={isPopoverOpen}
                onStatusClick={onStatusClick}
                t={t}
              />
            </span>
            <span className="mt-0.5 block text-xs font-medium text-sigma-muted">{meta.shortTicker}</span>
          </span>
        </span>
        <span className="text-right">
          <span className="block whitespace-nowrap">
            <span className="text-sm font-bold tabular-nums text-sigma-text">{formatValue(index.value, locale)}</span>{" "}
            <span className="text-xs font-medium text-sigma-muted">{currencyFor(index)}</span>
          </span>
          <ChangeText change={index.change_pct} className="mt-0.5 justify-end text-xs" />
        </span>
      </div>
    </div>
  );
}

function IndexIcon({ className, symbol }: { className?: string; symbol: string }) {
  const meta = indexMeta[symbol];
  const label = meta?.iconLabel || "<>";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white shadow-sm",
        iconClasses[symbol] ?? "bg-sigma-accent",
        className
      )}
    >
      {label}
    </span>
  );
}

function StatusButton({
  onClick,
  t
}: {
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  t: ChartTranslator;
}) {
  return (
    <button
      aria-label={t("status.details")}
      data-market-popover-root="true"
      className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-sigma-bg text-xs font-bold leading-none text-sigma-muted hover:bg-sigma-line/70 hover:text-sigma-text"
      onClick={onClick}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      type="button"
    >
      -
    </button>
  );
}

function StatusPopoverControl({
  align,
  id,
  index,
  isOpen,
  onStatusClick,
  t
}: {
  align?: "left" | "right";
  id: string;
  index: MarketIndex;
  isOpen: boolean;
  onStatusClick: (event: ReactMouseEvent<HTMLButtonElement>, id: string) => void;
  t: ChartTranslator;
}) {
  return (
    <span className="relative inline-flex" data-market-popover-root="true">
      <StatusButton onClick={(event) => onStatusClick(event, id)} t={t} />
      {isOpen ? <MarketStatusPopover align={align} index={index} t={t} /> : null}
    </span>
  );
}

function ChangeText({ change, className }: { change: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex font-semibold tabular-nums",
        change > 0 ? "text-sigma-success" : change < 0 ? "text-sigma-danger" : "text-sigma-text",
        className ?? "text-sm"
      )}
    >
      {formatChange(change)}
    </span>
  );
}

function MarketStatusPopover({
  align = "left",
  index,
  t
}: {
  align?: "left" | "right";
  index: MarketIndex;
  t: ChartTranslator;
}) {
  const timing = marketTiming(index);
  const statusTitle = index.is_trading ? t("status.openTitle") : t("status.closedTitle");
  const subtitle = index.is_trading ? t("status.openSubtitle") : t("status.closedSubtitle");
  const timingText = index.is_trading
    ? t("status.closesIn", { hours: timing.hours, minutes: timing.minutes })
    : t("status.opensIn", { hours: timing.hours, minutes: timing.minutes });

  return (
    <div
      data-market-popover-root="true"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      className={cn(
        "absolute top-7 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-sigma-line bg-sigma-surface p-4 text-left shadow-apple-soft",
        align === "right" ? "right-0 sm:right-2" : "left-0"
      )}
    >
      <p className="text-sm font-bold text-sigma-text">{statusTitle}</p>
      <p className="mt-1 text-xs leading-5 text-sigma-muted">{subtitle}</p>
      <p className="mt-2 text-sm font-bold text-sigma-text">{timingText}</p>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-sigma-muted">
          <span>{timing.weekday}</span>
          <span>00:00 - 24:00</span>
        </div>
        <div className="relative h-2 rounded-full bg-sigma-bg">
          <span
            className="absolute top-0 h-2 rounded-full bg-sigma-accent/25"
            style={{ left: `${timing.openPct}%`, width: `${Math.max(timing.closePct - timing.openPct, 2)}%` }}
          />
          <span
            className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-sigma-text"
            style={{ left: `${timing.nowPct}%` }}
          />
        </div>
      </div>
      <p className="mt-4 text-[11px] font-medium text-sigma-muted">
        {t("status.exchangeTimezone", { timezone: timezoneCity(index.trading_hours.timezone), offset: timezoneOffset(new Date(), index.trading_hours.timezone) })}
      </p>
    </div>
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

function orderMajorIndices(indices: MarketIndex[]) {
  return indices
    .filter((index) => majorIndexSymbols.includes(index.symbol as (typeof majorIndexSymbols)[number]))
    .sort((left, right) => symbolRank(majorIndexSymbols, left.symbol) - symbolRank(majorIndexSymbols, right.symbol));
}

function symbolRank(priority: readonly string[], symbol: string) {
  const index = priority.indexOf(symbol);
  return index === -1 ? priority.length : index;
}

function metaFor(index: MarketIndex) {
  return indexMeta[index.symbol] ?? {
    displayName: index.name,
    shortTicker: index.symbol,
    iconLabel: "",
    currency: currencyFor(index)
  };
}

function currencyFor(index: MarketIndex) {
  return index.currency ?? indexMeta[index.symbol]?.currency ?? currencyMap[index.symbol] ?? "";
}

function formatValue(value: number, locale: string) {
  return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(change: number) {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${Math.abs(change).toFixed(2)}%`;
}

function buildChartData(index: MarketIndex, range: RangeId): ChartPoint[] {
  if (range === "1d") {
    const labels = generateTradingAxis(index.trading_hours, index.symbol);
    const values = resampleValues(index.sparkline_24h, labels.length);
    return labels.map((point, pointIndex) => ({
      label: point.label,
      timestamp: point.timestamp.toISOString(),
      value: values[pointIndex] ?? values[values.length - 1] ?? index.value
    }));
  }
  const now = new Date(Date.UTC(axisReference.year, axisReference.month - 1, axisReference.day, 8, 0, 0));
  const points = expandSparkline(index.sparkline_24h, range);
  return points.map((value, pointIndex) => {
    const timestamp = timestampForRange(now, range, pointIndex, points.length);
    return {
      label: shouldShowRangeLabel(pointIndex, points.length, range) ? labelForRange(timestamp, range) : "",
      timestamp: timestamp.toISOString(),
      value
    };
  });
}

function expandSparkline(values: number[], range: RangeId): number[] {
  const multiplier = range === "1d" ? 1 : Math.min(12, Math.max(2, Math.ceil(rangeDays[range] / 30)));
  const source = values.length >= 2 ? values : [100, 101];
  const expanded: number[] = [];
  for (let cycle = 0; cycle < multiplier; cycle += 1) {
    const drift = (cycle - multiplier + 1) * source[source.length - 1] * 0.002;
    expanded.push(...source.map((value) => Number((value + drift).toFixed(2))));
  }
  return expanded;
}

function timestampForRange(now: Date, range: RangeId, index: number, total: number) {
  const spanHours = rangeDays[range] * 24;
  const offsetMs = ((total - 1 - index) / Math.max(total - 1, 1)) * spanHours * 60 * 60 * 1000;
  return new Date(now.getTime() - offsetMs);
}

function labelForRange(date: Date, range: RangeId) {
  if (rangeDays[range] <= 7) {
    return new Intl.DateTimeFormat("en", { timeZone: chartTimeZone, weekday: "short" }).format(date);
  }
  if (rangeDays[range] >= 365) {
    return new Intl.DateTimeFormat("en", { month: "short", timeZone: chartTimeZone, year: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: chartTimeZone }).format(date);
}

function shouldShowRangeLabel(index: number, total: number, range: RangeId) {
  if (range === "1d" || total <= 2) {
    return true;
  }
  const targetTicks = rangeDays[range] <= 7 ? 6 : 7;
  const interval = Math.max(1, Math.floor((total - 1) / (targetTicks - 1)));
  return index === 0 || index === total - 1 || index % interval === 0;
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

function marketTiming(index: MarketIndex) {
  const now = new Date();
  const parts = dateParts(now, index.trading_hours.timezone);
  const openMinutes = timeToMinutes(index.trading_hours.open);
  const closeMinutes = timeToMinutes(index.trading_hours.close);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const nowWeekMinutes = parts.weekdayIndex * 1440 + currentMinutes;
  const targetMinutes = index.is_trading
    ? parts.weekdayIndex * 1440 + closeMinutes
    : nextOpenWeekMinutes(parts.weekdayIndex, currentMinutes, openMinutes, closeMinutes);

  const minutesUntilTarget = Math.max(1, Math.ceil(targetMinutes - nowWeekMinutes));
  return {
    closePct: (closeMinutes / 1440) * 100,
    hours: Math.floor(minutesUntilTarget / 60),
    minutes: minutesUntilTarget % 60,
    nowPct: Math.min(Math.max((currentMinutes / 1440) * 100, 0), 100),
    openPct: (openMinutes / 1440) * 100,
    weekday: parts.weekday
  };
}

function nextOpenWeekMinutes(weekdayIndex: number, currentMinutes: number, openMinutes: number, closeMinutes: number) {
  if (weekdayIndex >= 1 && weekdayIndex <= 5 && currentMinutes < openMinutes) {
    return weekdayIndex * 1440 + openMinutes;
  }
  let daysUntilOpen = 1;
  if (weekdayIndex === 6) {
    daysUntilOpen = 2;
  } else if (weekdayIndex === 5 && currentMinutes >= closeMinutes) {
    daysUntilOpen = 3;
  }
  return (weekdayIndex + daysUntilOpen) * 1440 + openMinutes;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
    weekday: "short"
  }).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekday = valueFor("weekday");
  return {
    day: Number(valueFor("day")),
    hour: Number(valueFor("hour")),
    minute: Number(valueFor("minute")),
    weekday,
    weekdayIndex: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday)
  };
}

function timezoneCity(timeZone: string) {
  return timeZone.split("/").pop()?.replaceAll("_", " ") ?? timeZone;
}

function generateTradingAxis(tradingHours: MarketIndex["trading_hours"], symbol: string): Array<{ label: string; timestamp: Date }> {
  const open = timeParts(tradingHours.open);
  const close = timeParts(tradingHours.close);
  const breaks = marketBreaks[symbol] ?? [];
  const openDate = zonedTimeToDate(axisReference, open, tradingHours.timezone);
  let closeDate = zonedTimeToDate(axisReference, close, tradingHours.timezone);
  if (closeDate <= openDate) {
    closeDate = new Date(closeDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const points: Array<{ label: string; timestamp: Date }> = [];
  let cursor = openDate;
  let previousDay = beijingParts(cursor).day;
  while (cursor <= closeDate) {
    if (!isInsideTradingBreak(cursor, tradingHours.timezone, breaks)) {
      const parts = beijingParts(cursor);
      const minuteOfDay = parts.hour * 60 + parts.minute;
      const isLabelTick = minuteOfDay % 30 === 0;
      if (parts.day !== previousDay) {
        points.push({ label: String(parts.day), timestamp: new Date(cursor) });
        previousDay = parts.day;
      } else {
        points.push({
          label: isLabelTick
            ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
            : "",
          timestamp: new Date(cursor)
        });
      }
    }
    cursor = new Date(cursor.getTime() + 60 * 1000);
  }
  return points;
}

function isInsideTradingBreak(
  date: Date,
  timeZone: string,
  breaks: Array<{ start: string; end: string }>
) {
  if (breaks.length === 0) {
    return false;
  }
  const parts = zonedParts(date, timeZone);
  const currentMinutes = parts.hour * 60 + parts.minute;
  return breaks.some((item) => {
    const start = timeToMinutes(item.start);
    const end = timeToMinutes(item.end);
    return currentMinutes > start && currentMinutes < end;
  });
}

function resampleValues(values: number[], targetLength: number): number[] {
  const source = values.length >= 2 ? values : [values[0] ?? 100, values[0] ?? 100];
  if (targetLength <= 1) {
    return [source[0]];
  }
  const lastSourceIndex = source.length - 1;
  return Array.from({ length: targetLength }, (_, targetIndex) => {
    const sourcePosition = (targetIndex / (targetLength - 1)) * lastSourceIndex;
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(Math.ceil(sourcePosition), lastSourceIndex);
    const ratio = sourcePosition - leftIndex;
    return Number((source[leftIndex] + (source[rightIndex] - source[leftIndex]) * ratio).toFixed(2));
  });
}

function timeParts(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

function zonedTimeToDate(
  date: { day: number; month: number; year: number },
  time: { hour: number; minute: number },
  timeZone: string
) {
  let utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0));
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedParts(utcDate, timeZone);
    const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const targetAsUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0);
    utcDate = new Date(utcDate.getTime() - (zonedAsUtc - targetAsUtc));
  }
  return utcDate;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    day: Number(valueFor("day")),
    hour: Number(valueFor("hour")),
    minute: Number(valueFor("minute")),
    month: Number(valueFor("month")),
    year: Number(valueFor("year"))
  };
}

function beijingParts(date: Date) {
  const parts = zonedParts(date, chartTimeZone);
  return {
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute
  };
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
  lineColor,
  locale,
  payload,
  viewBox
}: TooltipProps<number, string> & { lineColor: string; locale: string; viewBox?: { width?: number } }) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !point) {
    return null;
  }
  const date = new Date(point.timestamp);
  const offset = timezoneOffset(date, chartTimeZone);
  const tooltipWidth = 120;
  const gap = 12;
  const x = coordinate?.x ?? 0;
  const chartWidth = typeof viewBox?.width === "number" ? viewBox.width : 640;
  const translateX = x > chartWidth - tooltipWidth - gap - 20 ? -(tooltipWidth + gap) : gap;

  return (
    <div
      className="min-w-[100px] rounded-md px-2 py-1.5 text-center shadow-lg"
      style={{
        background: "rgb(10, 10, 10)",
        borderTop: `2px solid ${lineColor}`,
        pointerEvents: "none",
        transform: `translate(${translateX}px, -50%)`,
        width: tooltipWidth
      }}
    >
      <p className="text-[12px] font-medium leading-tight text-white">{formatValue(point.value, locale)}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-[#aaaaaa]">
        {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: chartTimeZone, year: "2-digit" }).format(date)}
      </p>
      <p className="text-[10px] leading-tight text-[#aaaaaa]">
        {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: chartTimeZone }).format(date)} {offset}
      </p>
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
