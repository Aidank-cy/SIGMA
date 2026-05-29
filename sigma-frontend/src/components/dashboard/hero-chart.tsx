"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useMarketClock } from "@/hooks/useMarketClock";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import {
  buildChartBoundaryTicks,
  buildChartTicks,
  buildChartXAxisDomain,
  calculateActiveRangeChange,
  formatRangeAxisTick,
  formatTooltipTime,
  marketChartRanges,
  toMarketChartDataByRange,
  type MarketChartPoint
} from "@/lib/marketChart";
import { computeChartYDomain, isTradingHoursActive } from "@/lib/marketSessions";
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

const tooltipPanelStyle = {
  backgroundColor: "var(--foreground)",
  color: "var(--background)",
  border: "none",
  borderRadius: "16px",
  padding: "10px 16px",
  fontSize: "13px",
  fontWeight: 700
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

interface HeroChartProps {
  activeMarket?: string;
  onActiveMarketChange?: (symbol: string) => void;
}

export function HeroChart({ activeMarket, onActiveMarketChange }: HeroChartProps) {
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
  const [direction, setDirection] = useState(0);
  const previousMarketRef = useRef<string | undefined>(undefined);
  const selectedMarket = activeMarket ?? markets[0]?.symbol ?? "SIGMA";

  useEffect(() => {
    if (markets.length > 0 && !markets.some((market) => market.symbol === selectedMarket)) {
      onActiveMarketChange?.(markets[0].symbol);
    }
  }, [markets, onActiveMarketChange, selectedMarket]);

  useEffect(() => {
    const previousMarket = previousMarketRef.current;
    if (previousMarket && previousMarket !== selectedMarket) {
      const previousIndex = markets.findIndex((market) => market.symbol === previousMarket);
      const nextIndex = markets.findIndex((market) => market.symbol === selectedMarket);
      if (previousIndex !== -1 && nextIndex !== -1) {
        setDirection(nextIndex > previousIndex ? 1 : -1);
      }
    }
    previousMarketRef.current = selectedMarket;
  }, [markets, selectedMarket]);

  const currentData = markets.find((market) => market.symbol === selectedMarket) ?? markets[0];
  const chartData = currentData?.dataByRange[activeRange] ?? currentData?.data ?? [];
  const { changePct, changeSign, isPositive, pointChange } = calculateActiveRangeChange({
    activeRange,
    chartData,
    currentValue: currentData?.price ?? 0,
    fallbackChangePct: currentData?.change ?? 0,
    previousClose: currentData?.previousClose ?? 0
  });
  const chartSessions = currentData?.tradingHours.beijing_sessions?.length
    ? currentData.tradingHours.beijing_sessions
    : currentData?.tradingHours.sessions ?? [];
  const chartTimeZone = "Asia/Shanghai";
  const chartTicks = useMemo(
    () => buildChartTicks(activeRange, chartSessions, chartTimeZone, now, chartData),
    [activeRange, chartData, chartSessions, chartTimeZone, now]
  );
  const xAxisDomain = useMemo(
    () => buildChartXAxisDomain(activeRange, chartSessions, chartData),
    [activeRange, chartData, chartSessions]
  );
  const boundaryTicks = useMemo(
    () => buildChartBoundaryTicks(activeRange, chartData, chartSessions, chartTimeZone),
    [activeRange, chartData, chartSessions, chartTimeZone]
  );
  const yAxisDomain = useMemo(
    () => computeChartYDomain(chartData, currentData?.previousClose),
    [chartData, currentData?.previousClose]
  );

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 lg:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-4">
            <div className="h-7 w-28 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 w-64 max-w-full animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="h-10 w-36 animate-pulse rounded-xl bg-muted" />
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
            <span className="rounded-xl bg-muted px-2.5 py-1 text-sm font-bold text-muted-foreground">
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
              <span className={cn(!currentData?.isTrading && "font-bold")}>
                {currentData?.isTrading ? t("live") : chartT("closed")}
              </span>
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
              key={selectedMarket}
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
            key={`${selectedMarket}-price`}
          >
            <span className="text-lg font-bold text-muted-foreground lg:text-xl">
              {currentData?.currency}
            </span>
            {currentData?.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </motion.p>
          <motion.div
            animate={{ opacity: 1 }}
            className={cn(
              "mt-1 flex items-center justify-end gap-1.5 text-base font-bold",
              isPositive ? "text-chart-1" : "text-chart-2"
            )}
            initial={{ opacity: 0 }}
            key={`${selectedMarket}-change`}
          >
            {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            <span>{`${changeSign}${pointChange.toFixed(2)} (${changeSign}${changePct.toFixed(2)}%)`}</span>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="relative h-56 lg:h-72"
      >
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="absolute inset-0"
            exit={{ opacity: 0, x: direction * -80 }}
            initial={{ opacity: 0, x: direction * 80 }}
            key={selectedMarket}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm font-bold text-muted-foreground">
                {chartT("chartDataLoading")}
              </div>
            ) : (
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={chartData} margin={{ bottom: 14, left: 50, right: 50, top: 10 }}>
                  <defs>
                    <linearGradient id="colorPositive" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNegative" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    allowDataOverflow={false}
                    axisLine={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.28 }}
                    dataKey="time"
                    domain={xAxisDomain}
                    minTickGap={40}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 13, fontWeight: 600 }}
                    tickFormatter={(value) => formatRangeAxisTick(Number(value), activeRange, chartTimeZone, now, chartSessions, chartData)}
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
                        const value = Number(payload[0].payload?.value ?? 0);
                        return (
                          <div style={tooltipPanelStyle}>
                            <p className="text-base font-bold">
                              {value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                            <p className="mt-1 text-xs text-background/70">
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
                    stroke={isPositive ? "var(--chart-1)" : "var(--chart-2)"}
                    strokeWidth={2}
                    type="linear"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </AnimatePresence>

      </motion.div>

      <div className="mb-2 mt-4 flex items-center justify-center gap-2">
        {markets.map((market) => (
          <button
            aria-label={market.name}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              selectedMarket === market.symbol ? "w-8 bg-primary" : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
            )}
            key={market.name}
            onClick={() => {
              setDirection(markets.findIndex((item) => item.symbol === market.symbol) > markets.findIndex((item) => item.symbol === selectedMarket) ? 1 : -1);
              onActiveMarketChange?.(market.symbol);
            }}
            type="button"
          />
        ))}
      </div>

      <div className="mx-auto flex max-w-fit items-center justify-center gap-1 rounded-xl bg-muted/50 p-1.5">
        {marketChartRanges.map((range) => (
          <button
            className={cn(
              "relative rounded-xl px-5 py-2 text-sm font-bold transition-all duration-200",
              activeRange === range ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            key={range}
            onClick={() => setActiveRange(range)}
            type="button"
          >
            {activeRange === range ? (
              <motion.div
                className="absolute inset-0 rounded-xl border border-border bg-card shadow-sm"
                layoutId="heroTimeRange"
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            ) : null}
            <span className="relative z-10">{range}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
