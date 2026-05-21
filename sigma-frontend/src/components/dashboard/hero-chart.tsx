"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useMarketClock } from "@/hooks/useMarketClock";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import {
  buildChartBoundaryTicks,
  buildChartTicks,
  buildChartXAxisDomain,
  formatRangeAxisTick,
  formatTooltipTime,
  marketChartRanges,
  toMarketChartDataByRange,
  type MarketChartPoint
} from "@/lib/marketChart";
import { isTradingHoursActive, previousCloseAxisDomain } from "@/lib/marketSessions";
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

interface MarketChartData {
  change: number;
  data: MarketChartPoint[];
  dataByRange: Record<string, MarketChartPoint[]>;
  name: string;
  price: number;
  previousClose: number;
  symbol: string;
  currency: string;
  isTrading: boolean;
  tradingHours: MarketIndex["trading_hours"];
}

export function HeroChart() {
  const t = useTranslations("dashboard");
  const chartT = useTranslations("feed.chart");
  const { data, isLoading } = useMarketIndices();
  const now = useMarketClock();
  const [activeRange, setActiveRange] = useState("1D");
  const markets = useMemo<MarketChartData[]>(() => {
    const indices = data?.indices ?? [];
    return indices.map((index) => {
      const dataByRange = toMarketChartDataByRange(index, now);
      return {
        change: index.change_pct,
        data: dataByRange["1D"] ?? [],
        dataByRange,
        name: index.name,
        price: index.value,
        previousClose: index.previous_close,
        symbol: index.symbol,
        currency: index.currency,
        isTrading: index.is_trading || isTradingHoursActive(index.trading_hours, now),
        tradingHours: index.trading_hours
      };
    });
  }, [data, now]);
  const [activeMarket, setActiveMarket] = useState(markets[0]?.name ?? "SIGMA");
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
  const chartData = currentData?.dataByRange[activeRange] ?? currentData?.data ?? [];
  const chartSessions = currentData?.tradingHours.sessions ?? [];
  const chartTimeZone = currentData?.tradingHours.timezone ?? "Asia/Shanghai";
  const chartTicks = useMemo(
    () => buildChartTicks(activeRange, chartSessions, chartTimeZone, now),
    [activeRange, chartSessions, chartTimeZone, now]
  );
  const xAxisDomain = useMemo(() => buildChartXAxisDomain(activeRange, chartSessions), [activeRange, chartSessions]);
  const boundaryTicks = useMemo(() => buildChartBoundaryTicks(activeRange), [activeRange]);
  const yAxisDomain = useMemo(
    () => previousCloseAxisDomain(chartData),
    [chartData]
  );

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

  if (!currentData) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 lg:p-8">
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground lg:h-72">
          {chartT("empty")}
        </div>
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
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                currentData?.isTrading ? "bg-chart-1/10 text-chart-1" : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  currentData?.isTrading ? "animate-pulse bg-chart-1" : "bg-black"
                )}
              />
              {currentData?.isTrading ? t("live") : chartT("closed")}
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
              <AreaChart data={chartData} margin={{ bottom: 14, left: 50, right: 50, top: 10 }}>
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
                  allowDataOverflow={false}
                  axisLine={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.28 }}
                  dataKey="time"
                  domain={xAxisDomain}
                  interval={0}
                  minTickGap={0}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 13, fontWeight: 600 }}
                  tickFormatter={(value) => formatRangeAxisTick(Number(value), activeRange, chartTimeZone, now)}
                  tickLine={false}
                  tickMargin={12}
                  ticks={chartTicks}
                  padding={{ left: 18, right: 18 }}
                  type="number"
                />
                <YAxis axisLine={false} domain={yAxisDomain} hide tickLine={false} />
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
                  type="linear"
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
        {marketChartRanges.map((range) => (
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
