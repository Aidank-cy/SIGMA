"use client"

import type { ReactNode } from "react"
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
  calculateActiveRangeChange,
  formatRangeAxisTick,
  marketChartRanges,
  toMarketChartData,
} from "@/lib/marketChart"
import { computeChartYDomain, isPreMarketClearWindow } from "@/lib/marketSessions"
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

const SYMBOL_HIDDEN_TICKS: Record<string, number[]> = {
  HSI: [120],
  N225: [120],
  SSE: [90],
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
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
  const indices = useMemo(() => data?.indices ?? [], [data?.indices])
  const groupedIndices = useMemo(() => groupIndicesByRegion(indices, activeRegion), [activeRegion, indices])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="h-52 animate-pulse rounded-2xl border border-border bg-card" key={index} />
        ))}
      </div>
    )
  }

  if (indices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <IndicesControls activeRange={activeRange} activeRegion={activeRegion} setActiveRange={setActiveRange} setActiveRegion={setActiveRegion} />
      <IndicesGroups activeRange={activeRange} groupedIndices={groupedIndices} now={now} />
    </div>
  )
}

function IndicesControls({ activeRange, activeRegion, setActiveRange, setActiveRegion }: { activeRange: string; activeRegion: RegionFilter; setActiveRange: (range: string) => void; setActiveRegion: (region: RegionFilter) => void }) {
  const t = useTranslations("markets")
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-fit items-center justify-center gap-1 rounded-2xl bg-muted/50 p-1.5">
        {marketChartRanges.map((range) => <FilterButton active={activeRange === range} key={range} layoutId="indicesTimeRange" onClick={() => setActiveRange(range)}>{range}</FilterButton>)}
      </div>
      <div className="flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl bg-muted/50 p-1.5">
        {(["all", ...regionOrder] as RegionFilter[]).map((region) => <FilterButton active={activeRegion === region} key={region} layoutId="indicesRegionFilter" onClick={() => setActiveRegion(region)}>{region === "all" ? t("indexRegionAll") : t(`indexRegions.${region}`)}</FilterButton>)}
      </div>
    </div>
  )
}

function FilterButton({ active, children, layoutId, onClick }: { active: boolean; children: ReactNode; layoutId: string; onClick: () => void }) {
  return (
    <button className={cn("relative rounded-xl px-5 py-2 text-sm font-bold transition-all duration-200", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")} onClick={onClick} type="button">
      {active ? <motion.div className="absolute inset-0 rounded-xl border border-border bg-card shadow-sm" layoutId={layoutId} transition={{ duration: 0.2, ease: "easeOut" }} /> : null}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

function IndicesGroups({ activeRange, groupedIndices, now }: { activeRange: string; groupedIndices: Array<{ indices: MarketIndex[]; region: IndexRegion }>; now: Date }) {
  const t = useTranslations("markets")
  return (
    <motion.div animate="show" className="space-y-7" initial="hidden" variants={containerVariants}>
      {groupedIndices.map((group) => (
        <section className="space-y-3" key={group.region}>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">{t(`indexRegions.${group.region}`)}</h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {group.indices.map((index) => <IndexCard activeRange={activeRange} index={index} key={index.symbol} now={now} />)}
          </div>
        </section>
      ))}
    </motion.div>
  )
}

function IndexCard({ activeRange, index, now }: { activeRange: string; index: MarketIndex; now: Date }) {
  const state = indexChartState(index, activeRange, now)
  return (
    <motion.div className="cursor-pointer rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" transition={{ duration: 0.2 }} variants={itemVariants} whileHover={{ y: -4 }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-foreground">{index.name}</h3>
        <span className="rounded-xl bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">{index.symbol}</span>
      </div>
      <IndexPrice index={index} state={state} />
      <IndexChart activeRange={activeRange} index={index} now={now} state={state} />
    </motion.div>
  )
}

function IndexPrice({ index, state }: { index: MarketIndex; state: ReturnType<typeof indexChartState> }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-sm font-bold text-muted-foreground">{index.currency}</span>
        <span className="text-3xl font-bold tabular-nums text-foreground">{index.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className={cn("flex shrink-0 items-center gap-1 text-sm font-bold", state.isAwaitingOpen ? "text-muted-foreground" : state.isPositive ? "text-chart-1" : "text-chart-2")}>
        {state.isAwaitingOpen ? null : state.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        <span>{`${state.changeSign}${state.displayPointChange} (${state.displayChangePct.toFixed(2)}%)`}</span>
      </div>
    </div>
  )
}

function IndexChart({ activeRange, index, now, state }: { activeRange: string; index: MarketIndex; now: Date; state: ReturnType<typeof indexChartState> }) {
  const t = useTranslations("markets")
  return (
    <div className="-mx-2 h-28">
      {state.chartData.length === 0 ? (
        <div className="mx-2 flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm font-bold text-muted-foreground">{t("chartDataLoading")}</div>
      ) : (
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={state.chartData} margin={{ bottom: 18, left: 26, right: 26, top: 2 }}>
            <defs>
              <linearGradient id={`gradient-${index.symbol}-${activeRange}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={state.chartColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={state.chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis allowDataOverflow={false} axisLine={false} dataKey="time" domain={state.xAxisDomain} height={24} interval={0} minTickGap={0} tick={{ fill: "var(--muted-foreground)", fontSize: 13, fontWeight: 600 }} tickFormatter={(value) => formatRangeAxisTick(Number(value), activeRange, state.chartTimeZone, now, state.chartSessions, state.chartData)} tickLine={false} tickMargin={8} ticks={state.filteredTicks} padding={{ left: 12, right: 12 }} type="number" />
            <YAxis domain={computeChartYDomain(state.chartData, state.rangeStartValue)} hide />
            <Area animationDuration={450} dataKey="value" fill={`url(#gradient-${index.symbol}-${activeRange})`} stroke={state.chartColor} strokeWidth={2} type="linear" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function indexChartState(index: MarketIndex, activeRange: string, now: Date) {
  const chartData = toMarketChartData(index, activeRange, now)
  const { changePct, changeSign: rangeChangeSign, isPositive, pointChange, rangeStartValue } = calculateActiveRangeChange({ activeRange, chartData, currentValue: index.value, fallbackChangePct: index.change_pct, previousClose: index.previous_close })
  const chartSessions = index.trading_hours.beijing_sessions?.length ? index.trading_hours.beijing_sessions : index.trading_hours.sessions
  const chartTimeZone = "Asia/Shanghai"
  const chartTicks = buildCompactChartTicks(activeRange, chartSessions, chartTimeZone, activeRange === "5D" ? 5 : 4, now, chartData)
  const hiddenTicks = activeRange === "1D" ? new Set(SYMBOL_HIDDEN_TICKS[index.symbol] ?? []) : new Set<number>()
  const filteredTicks = chartTicks.filter((tick) => !hiddenTicks.has(tick))
  const xAxisDomain = buildChartXAxisDomain(activeRange, chartSessions, chartData)
  const isAwaitingOpen = isPreMarketClearWindow(index.trading_hours, now)
  const displayChangePct = isAwaitingOpen ? 0 : changePct
  const changeSign = isAwaitingOpen ? "" : rangeChangeSign
  const displayPointChange = isAwaitingOpen ? "0.00" : pointChange.toFixed(2)
  const chartColor = isPositive ? "var(--chart-1)" : "var(--chart-2)"
  return { changeSign, chartColor, chartData, chartSessions, chartTimeZone, displayChangePct, displayPointChange, filteredTicks, isAwaitingOpen, isPositive, rangeStartValue, xAxisDomain }
}
