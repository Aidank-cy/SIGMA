"use client"

import { motion } from "framer-motion"
import { ArrowRight, FileText, Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { useAuth } from "@/components/AuthProvider"
import { useToast } from "@/components/ui/Toast"
import { useItems } from "@/hooks/useItems"
import { useReports } from "@/hooks/useReports"
import { useSentimentStats, useTrendingKeywords } from "@/hooks/useStats"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Category, ItemSummary, ReportSummary, Sentiment } from "@/lib/types"

const timeRanges = ["24h", "7D", "14D", "30D"]
const timeRangeDays: Record<string, number> = { "24h": 1, "7D": 7, "14D": 14, "30D": 30 }
const categories: Category[] = ["politics", "finance", "technology", "macro"]

const categoryColors: Record<Category, string> = {
  finance: "oklch(0.65 0.22 145)",
  macro: "oklch(0.7 0.15 60)",
  other: "oklch(0.4 0 0)",
  politics: "oklch(0.6 0.22 25)",
  technology: "oklch(0.6 0.18 250)"
}

function inferSentiment(item: ItemSummary): Sentiment {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase()
  if (/(fall|drop|risk|bear|decline|weak|cut|pressure|loss)/.test(text)) return "bearish"
  if (/(rise|gain|bull|growth|beat|strong|surge|record|upgrade)/.test(text)) return "bullish"
  return "neutral"
}

function formatRelative(date: string, locale: string) {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  return formatter.format(Math.round(hours / 24), "day")
}

function readingTime(content: string) {
  return Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 220))
}

function buildDailyVolume(items: ItemSummary[], locale: string, days = 7) {
  if (days <= 1) {
    return buildHourlyVolume(items, locale)
  }

  const counts = new Map<string, number>()
  const dateFormat: Intl.DateTimeFormatOptions = days <= 7 ? { weekday: "short" } : { month: "short", day: "numeric" }
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    const key = date.toISOString().slice(0, 10)
    counts.set(key, 0)
  }
  items.forEach((item) => {
    const key = item.published_at.slice(0, 10)
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return Array.from(counts.entries()).map(([day, articles]) => ({
    articles,
    day: new Intl.DateTimeFormat(locale, dateFormat).format(new Date(`${day}T00:00:00Z`))
  }))
}

function buildHourlyVolume(items: ItemSummary[], locale: string) {
  const now = new Date()
  const counts = new Map<string, number>()
  const hourKeys: string[] = []
  for (let offset = 23; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * 3600_000)
    const key = date.toISOString().slice(0, 13)
    hourKeys.push(key)
    counts.set(key, 0)
  }
  items.forEach((item) => {
    const key = item.published_at.slice(0, 13)
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return hourKeys.map((key) => ({
    articles: counts.get(key) ?? 0,
    day: new Intl.DateTimeFormat(locale, { hour: "2-digit", hour12: false }).format(new Date(`${key}:00:00Z`))
  }))
}

function calculateWindowSentiment(items: ItemSummary[], dateFrom: string, now: Date) {
  const startTime = new Date(dateFrom).getTime()
  const endTime = now.getTime()
  const windowItems = items.filter((item) => {
    const publishedAt = new Date(item.published_at).getTime()
    return publishedAt >= startTime && publishedAt <= endTime
  })
  const total = windowItems.length
  if (total === 0) {
    return { sentiment: 0, total }
  }
  const bullish = windowItems.filter((item) => inferSentiment(item) === "bullish").length
  return {
    sentiment: Math.round((bullish / total) * 100),
    total
  }
}

function formatSentimentSnapshotLabel(date: Date, locale: string, days = 7) {
  return new Intl.DateTimeFormat(locale, {
    day: days > 1 ? "numeric" : undefined,
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: days > 1 ? "short" : undefined
  }).format(date)
}

function buildSourceData(items: ItemSummary[]) {
  const counts = new Map<string, number>()
  items.forEach((item) => counts.set(item.source_name, (counts.get(item.source_name) ?? 0) + 1))
  const total = items.length || 1
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count], index) => ({
      color: ["oklch(0.65 0.22 145)", "oklch(0.6 0.18 250)", "oklch(0.7 0.15 60)", "oklch(0.55 0.18 275)"][index],
      name,
      value: Math.round((count / total) * 100)
    }))
}

function buildCategoryRows(items: ItemSummary[], t: (key: string) => string) {
  return categories.map((category) => {
    const categoryItems = items.filter((item) => item.category === category)
    const sentiments = categoryItems.map(inferSentiment)
    const total = sentiments.length || 1
    const bullish = Math.round((sentiments.filter((value) => value === "bullish").length / total) * 100)
    const bearish = Math.round((sentiments.filter((value) => value === "bearish").length / total) * 100)
    return {
      articles: categoryItems.length,
      bearish,
      bullish,
      name: t(`categories.${category}`),
      neutral: Math.max(0, 100 - bullish - bearish),
      raw: category,
      trend: bullish - bearish
    }
  })
}

function ReportCard({ report }: { report: ReportSummary }) {
  const locale = useLocale()
  const t = useTranslations("analytics")

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
      initial={{ opacity: 0, y: 20 }}
      whileHover={{ y: -4 }}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {t(`reportTypes.${report.report_type}`)}
        </span>
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mb-1 font-semibold text-foreground">{report.title}</h3>
      <p className="mb-1 text-sm text-muted-foreground">
        {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(report.generated_at))}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        {t("reportMeta", { count: report.item_count, minutes: readingTime(report.content) })}
      </p>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{formatRelative(report.generated_at, locale)}</span>
        <Link className="flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:gap-2" href={`/${locale}/reports/${report.id}`}>
          {t("readReport")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </motion.div>
  )
}

export default function AnalyticsPage() {
  const locale = useLocale()
  const t = useTranslations("analytics")
  const feedT = useTranslations("feed")
  const { user } = useAuth()
  const { showToast } = useToast()
  const [timeRange, setTimeRange] = useState("7D")
  const [isGenerating, setIsGenerating] = useState(false)
  const [liveTick, setLiveTick] = useState(0)
  const [sentimentSnapshots, setSentimentSnapshots] = useState<Array<{ day: string; sentiment: number; timestamp: number; total: number }>>([])
  const rangeDays = useMemo(() => timeRangeDays[timeRange] ?? 7, [timeRange])
  const dateFrom = useMemo(() => {
    const date = new Date()
    if (rangeDays <= 1) {
      date.setHours(date.getHours() - 24)
    } else {
      date.setDate(date.getDate() - rangeDays)
    }
    return date.toISOString()
  }, [liveTick, rangeDays])
  const sentiment = useSentimentStats(rangeDays)
  const keywords = useTrendingKeywords(rangeDays)
  const itemQuery = useItems({ date_from: dateFrom, page_size: 500 })
  const reportsQuery = useReports(undefined, 6)
  const items = useMemo(() => itemQuery.data?.pages.flatMap((page) => page.items) ?? [], [itemQuery.data])
  const reports = useMemo(() => {
    const all = reportsQuery.data?.pages.flatMap((page) => page.items) ?? []
    return all.filter((report) => report.generated_at >= dateFrom)
  }, [reportsQuery.data, dateFrom])

  useEffect(() => {
    if (itemQuery.hasNextPage && !itemQuery.isFetchingNextPage) {
      void itemQuery.fetchNextPage()
    }
  }, [itemQuery.data?.pages.length, itemQuery.fetchNextPage, itemQuery.hasNextPage, itemQuery.isFetchingNextPage])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLiveTick((current) => current + 1)
      itemQuery.mutate()
      sentiment.mutate()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [itemQuery.mutate, sentiment.mutate])

  useEffect(() => {
    setSentimentSnapshots([])
  }, [timeRange])

  const sentimentData = useMemo(() => {
    const itemSentiments = items.map(inferSentiment)
    const bullish = itemSentiments.length > 0
      ? Math.round((itemSentiments.filter((value) => value === "bullish").length / itemSentiments.length) * 100)
      : Math.round(sentiment.data?.bullish_pct ?? 0)
    const bearish = itemSentiments.length > 0 ? Math.round((itemSentiments.filter((value) => value === "bearish").length / itemSentiments.length) * 100) : 0
    const neutral = Math.max(0, 100 - bullish - bearish)
    return [
      { color: "oklch(0.65 0.22 145)", name: feedT("sentiment.bullish"), value: bullish },
      { color: "oklch(0.6 0.22 25)", name: feedT("sentiment.bearish"), value: bearish },
      { color: "oklch(0.4 0 0)", name: feedT("sentiment.neutral"), value: neutral }
    ]
  }, [feedT, items, sentiment.data?.bullish_pct])
  const bullishValue = sentimentData[0]?.value ?? 0
  const currentWindowSentiment = useMemo(
    () => calculateWindowSentiment(items, dateFrom, new Date()),
    [dateFrom, items, liveTick]
  )
  useEffect(() => {
    const timestamp = Date.now()
    const minuteKey = Math.floor(timestamp / 60_000)
    const snapshot = {
      day: formatSentimentSnapshotLabel(new Date(timestamp), locale, rangeDays),
      sentiment: currentWindowSentiment.sentiment,
      timestamp,
      total: currentWindowSentiment.total
    }
    setSentimentSnapshots((current) => {
      const withoutSameMinute = current.filter((entry) => Math.floor(entry.timestamp / 60_000) !== minuteKey)
      return [...withoutSameMinute, snapshot].slice(-60)
    })
  }, [currentWindowSentiment.sentiment, currentWindowSentiment.total, locale, rangeDays, liveTick])

  const trendData = useMemo(() => {
    if (sentimentSnapshots.length > 1) {
      return sentimentSnapshots
    }
    const now = new Date()
    const previous = new Date(now.getTime() - 60_000)
    return [
      {
        day: formatSentimentSnapshotLabel(previous, locale, rangeDays),
        sentiment: currentWindowSentiment.sentiment,
        timestamp: previous.getTime(),
        total: currentWindowSentiment.total
      },
      {
        day: formatSentimentSnapshotLabel(now, locale, rangeDays),
        sentiment: currentWindowSentiment.sentiment,
        timestamp: now.getTime(),
        total: currentWindowSentiment.total
      }
    ]
  }, [currentWindowSentiment.sentiment, currentWindowSentiment.total, locale, rangeDays, sentimentSnapshots])
  const trendChange = useMemo(() => {
    if (currentWindowSentiment.total === 0 || sentimentSnapshots.length < 2) {
      return null
    }
    return currentWindowSentiment.sentiment - sentimentSnapshots[0].sentiment
  }, [currentWindowSentiment.sentiment, currentWindowSentiment.total, sentimentSnapshots])
  const volumeData = useMemo(() => buildDailyVolume(items, locale, rangeDays), [items, locale, rangeDays])
  const sourceData = useMemo(() => buildSourceData(items), [items])
  const categoryData = useMemo(() => buildCategoryRows(items, feedT), [feedT, items])

  async function handleGenerateReport() {
    if (user?.role !== "admin") {
      showToast(t("adminOnly"), "error")
      return
    }
    setIsGenerating(true)
    const periodEnd = new Date()
    const periodStart = new Date()
    periodStart.setDate(periodEnd.getDate() - 1)
    try {
      await apiFetch("/reports/generate", {
        body: JSON.stringify({
          category_scope: ["politics", "finance", "technology", "macro"],
          locale,
          market_scope: ["us", "cn", "hk", "jp", "eu", "global"],
          period_end: periodEnd.toISOString().slice(0, 10),
          period_start: periodStart.toISOString().slice(0, 10),
          report_type: "daily"
        }),
        method: "POST"
      })
      showToast(t("generationQueued"), "success")
      reportsQuery.mutate()
    } catch {
      showToast(t("generationError"), "error")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <motion.div animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" initial={{ opacity: 0, y: -10 }}>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1">
          {timeRanges.map((range) => (
            <button
              className={cn("relative rounded-lg px-4 py-2 text-sm font-medium transition-colors", timeRange === range ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              key={range}
              onClick={() => setTimeRange(range)}
              type="button"
            >
              {timeRange === range && <motion.div className="absolute inset-0 rounded-lg bg-primary" transition={{ damping: 35, mass: 0.8, stiffness: 500, type: "spring" }} />}
              <span className="relative z-10">{range}</span>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.section animate="visible" className="grid grid-cols-2 gap-4 lg:grid-cols-4" initial="hidden" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}>
        <MetricCard title={t("sentimentOverview")}>
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer height={120} width={120}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" innerRadius={40} outerRadius={55} paddingAngle={2} stroke="none">
                  {sentimentData.map((entry) => <Cell fill={entry.color} key={entry.name} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-chart-1">{bullishValue}%</span>
              <span className="text-xs text-muted-foreground">{feedT("sentiment.bullish")}</span>
            </div>
          </div>
        </MetricCard>

        <MetricCard title={t("sentimentTrend")}>
          <ResponsiveContainer height={100} width="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="sentimentGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="sentiment" fill="url(#sentimentGradient)" stroke="oklch(0.65 0.22 145)" strokeWidth={2} type="linear" />
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
            </AreaChart>
          </ResponsiveContainer>
          {trendChange === null ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("notAvailable")}</p>
          ) : (
            <TrendLabel positive={trendChange >= 0} value={`${trendChange >= 0 ? "+" : ""}${trendChange}%`} />
          )}
        </MetricCard>

        <MetricCard title={t("articleVolume")}>
          <ResponsiveContainer height={100} width="100%">
            <BarChart data={volumeData}>
              <Bar dataKey="articles" fill="oklch(0.55 0.18 275)" radius={[4, 4, 0, 0]} />
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-bold text-foreground">{items.length}</span>
            <span className="text-xs text-muted-foreground">{t("articlesInRange", { range: timeRange })}</span>
          </div>
        </MetricCard>

        <MetricCard title={t("sourceDistribution")}>
          <ResponsiveContainer height={80} width="100%">
            <PieChart>
              <Pie data={sourceData} dataKey="value" innerRadius={25} outerRadius={40} paddingAngle={2} stroke="none">
                {sourceData.map((entry) => <Cell fill={entry.color} key={entry.name} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {sourceData.map((source) => (
              <div className="flex items-center gap-1.5 text-xs" key={source.name}>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: source.color }} />
                <span className="truncate text-muted-foreground">{source.name}</span>
                <span className="font-medium text-foreground">{source.value}%</span>
              </div>
            ))}
          </div>
        </MetricCard>
      </motion.section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t("sentimentByCategory")}</h2>
        <div className="grid gap-3">
          {categoryData.map((category) => (
            <motion.div className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5" key={category.raw} whileHover={{ y: -2 }}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-[140px] items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: categoryColors[category.raw] }} />
                  <span className="font-medium text-foreground">{category.name}</span>
                </div>
                <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full" style={{ backgroundColor: "oklch(0.65 0.22 145)", width: `${category.bullish}%` }} />
                  <div className="h-full" style={{ backgroundColor: "oklch(0.6 0.22 25)", width: `${category.bearish}%` }} />
                  <div className="h-full" style={{ backgroundColor: "oklch(0.4 0 0)", width: `${category.neutral}%` }} />
                </div>
                <div className="flex min-w-[180px] items-center justify-end gap-4">
                  <span className="text-sm text-muted-foreground">{t("articleCount", { count: category.articles })}</span>
                  <TrendLabel positive={category.trend >= 0} value={`${category.trend >= 0 ? "+" : ""}${category.trend}%`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="space-y-4" id="intelligence-reports">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("reports")}</h2>
          <motion.button
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={isGenerating}
            onClick={handleGenerateReport}
            type="button"
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.02 }}
          >
            <Plus className="h-4 w-4" />
            {t("generateReport")}
          </motion.button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => <ReportCard key={report.id} report={report} />)}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("topKeywords")}</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {(keywords.data?.items ?? []).map((keyword, index) => (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className={cn("flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all", index < 3 ? "border border-primary/20 bg-primary/10 text-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              initial={{ opacity: 0, scale: 0.9 }}
              key={keyword.keyword}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-muted-foreground">#</span>
              <span>{keyword.keyword}</span>
              <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", index < 3 ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground")}>{keyword.count}</span>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}

function MetricCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <motion.div className="rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} whileHover={{ y: -4 }}>
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </motion.div>
  )
}

function TrendLabel({ positive, value }: { positive: boolean; value: string }) {
  return (
    <div className={cn("flex items-center gap-1 text-sm font-medium", positive ? "text-chart-1" : "text-chart-2")}>
      {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      <span>{value}</span>
    </div>
  )
}
