"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from "recharts"

import { useMarketClock } from "@/hooks/useMarketClock"
import { useMarketIndices } from "@/hooks/useMarketIndices"
import {
  buildCompactChartTicks,
  buildChartXAxisDomain,
  formatRangeAxisTick,
  marketChartRanges,
  toMarketChartData,
} from "@/lib/marketChart"
import { isPreMarketClearWindow, sparklineAxisDomain } from "@/lib/marketSessions"
import type { Market, MarketIndex } from "@/lib/types"
import { cn } from "@/lib/utils"

type IndexRegion = "northAmerica" | "asia" | "europe"
type RegionFilter = "all" | IndexRegion

const regionOrder: IndexRegion[] = ["northAmerica", "asia", "europe"]
const regionMarkets: Record<IndexRegion, Market[]> = {
  northAmerica: ["us"],
  asia: ["cn", "hk", "jp", "kr", "tw"],
  europe: ["eu"],
}
const marketRegionMap = Object.fromEntries(
  regionOrder.flatMap((region) => regionMarkets[region].map((market) => [market, region]))
) as Partial<Record<Market, IndexRegion>>

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function groupIndicesByRegion(indices: MarketIndex[], activeRegion: RegionFilter): Array<{ indices: MarketIndex[]; region: IndexRegion }> {
  return regionOrder
    .filter((region) => activeRegion === "all" || activeRegion === region)
    .map((region) => ({
      region,
      indices: indices.filter((index) => marketRegionMap[index.market] === region),
    }))
    .filter((group) => group.indices.length > 0)
}

export function IndicesTab() {
  const t = useTranslations("markets")
  const { data, isLoading } = useMarketIndices()
  const now = useMarketClock()
  const [activeRange, setActiveRange] = useState("1D")
  const [activeRegion, setActiveRegion] = useState<RegionFilter>("all")
  const indices = data?.indices ?? []
  const groupedIndices = useMemo(() => groupIndicesByRegion(indices, activeRegion), [activeRegion, indices])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="h-52 animate-pulse rounded-xl border border-border bg-card" key={index} />
        ))}
      </div>
    )
  }

  if (indices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-fit items-center justify-center gap-1 rounded-xl bg-muted/50 p-1.5">
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
                  layoutId="indicesTimeRange"
                  transition={{ damping: 35, mass: 0.8, stiffness: 500, type: "spring" }}
                />
              ) : null}
              <span className="relative z-10">{range}</span>
            </button>
          ))}
        </div>

        <div className="flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl bg-muted/50 p-1.5">
          {(["all", ...regionOrder] as RegionFilter[]).map((region) => (
            <button
              className={cn(
                "relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                activeRegion === region ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              key={region}
              onClick={() => setActiveRegion(region)}
              type="button"
            >
              {activeRegion === region ? (
                <motion.div
                  className="absolute inset-0 rounded-lg border border-border bg-card shadow-md"
                  layoutId="indicesRegionFilter"
                  transition={{ damping: 35, mass: 0.8, stiffness: 500, type: "spring" }}
                />
              ) : null}
              <span className="relative z-10">
                {region === "all" ? t("indexRegionAll") : t(`indexRegions.${region}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <motion.div
        animate="show"
        className="space-y-7"
        initial="hidden"
        variants={containerVariants}
      >
        {groupedIndices.map((group) => (
          <section className="space-y-3" key={group.region}>
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t(`indexRegions.${group.region}`)}
              </h3>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {group.indices.map((index) => {
                const isPositive = index.change_pct >= 0
                const chartData = toMarketChartData(index, activeRange, now)
                const chartTimeZone = index.trading_hours.timezone
                const chartTicks = buildCompactChartTicks(
                  activeRange,
                  index.trading_hours.sessions,
                  chartTimeZone,
                  activeRange === "5D" ? 5 : 4,
                  now
                )
                const xAxisDomain = buildChartXAxisDomain(activeRange, index.trading_hours.sessions)
                const isAwaitingOpen = isPreMarketClearWindow(index.trading_hours, now)
                const displayChangePct = isAwaitingOpen ? 0 : index.change_pct
                const chartColor = isPositive
                  ? "oklch(0.65 0.22 145)"
                  : "oklch(0.6 0.22 25)"
                const chartColorFaded = isPositive
                  ? "oklch(0.65 0.22 145 / 0.1)"
                  : "oklch(0.6 0.22 25 / 0.1)"

                return (
                  <motion.div
                    className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
                    key={index.symbol}
                    transition={{ duration: 0.2 }}
                    variants={itemVariants}
                    whileHover={{ y: -4 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-foreground">{index.name}</h3>
                      <span className="bg-muted px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground">
                        {index.symbol}
                      </span>
                    </div>

                    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                          {index.currency}
                        </span>
                        <span className="text-3xl font-bold tabular-nums text-foreground">
                          {index.value.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "flex shrink-0 items-center gap-1 text-sm font-semibold",
                          isAwaitingOpen ? "text-muted-foreground" : isPositive ? "text-chart-1" : "text-chart-2"
                        )}
                      >
                        {isAwaitingOpen ? null : isPositive ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span>
                          {!isAwaitingOpen && isPositive ? "+" : ""}
                          {displayChangePct.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="-mx-2 h-28">
                      <ResponsiveContainer height="100%" width="100%">
                        <AreaChart data={chartData} margin={{ bottom: 18, left: 26, right: 26, top: 2 }}>
                          <defs>
                            <linearGradient
                              id={`gradient-${index.symbol}-${activeRange}`}
                              x1="0"
                              x2="0"
                              y1="0"
                              y2="1"
                            >
                              <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={chartColorFaded} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            allowDataOverflow={false}
                            axisLine={false}
                            dataKey="time"
                            domain={xAxisDomain}
                            height={24}
                            interval={0}
                            minTickGap={0}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 13, fontWeight: 600 }}
                            tickFormatter={(value) => formatRangeAxisTick(Number(value), activeRange, chartTimeZone, now)}
                            tickLine={false}
                            tickMargin={8}
                            ticks={chartTicks}
                            padding={{ left: 12, right: 12 }}
                            type="number"
                          />
                          <YAxis domain={sparklineAxisDomain(chartData)} hide />
                          <Area
                            animationDuration={450}
                            dataKey="value"
                            fill={`url(#gradient-${index.symbol}-${activeRange})`}
                            stroke={chartColor}
                            strokeWidth={2}
                            type="linear"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        ))}
      </motion.div>
    </div>
  )
}
