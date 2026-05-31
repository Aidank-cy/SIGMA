"use client";

import { motion } from "framer-motion";
import { FileText, Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";
import type { ReportSummary } from "@/lib/types";

import { categoryColors, darkTooltipContentStyle, extractExecutiveSummary, formatRelative, formatReportDisplayName, formatReportSubtitle, readingTime, reportTypeColors, timeRanges } from "./AnalyticsPageUtils";

type CategoryRow = { articles: number; bearish: number; bullish: number; name: string; neutral: number; raw: string; trend: number };
type Keyword = { count: number; keyword: string };

export function AnalyticsHeader({ setTimeRange, timeRange }: { setTimeRange: (range: string) => void; timeRange: string }) {
  const t = useTranslations("analytics");
  return (
    <motion.div animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" initial={{ opacity: 0, y: -10 }}>
      <div><h1 className="text-[32px] font-bold text-foreground">{t("title")}</h1><p className="text-sm text-foreground/60">{t("subtitle")}</p></div>
      <div className="flex items-center gap-1 rounded-2xl bg-muted/50 p-1">{timeRanges.map((range) => <button className={cn("relative rounded-xl px-4 py-2 text-sm font-bold transition-colors", timeRange === range ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")} key={range} onClick={() => setTimeRange(range)} type="button">{timeRange === range && <motion.div className="absolute inset-0 rounded-xl bg-primary" transition={{ duration: 0.2, ease: "easeOut" }} />}<span className="relative z-10">{range}</span></button>)}</div>
    </motion.div>
  );
}

export function MetricsOverview({ bullishValue, rangeItemsLength, sentimentData, sourceData, timeRange, trendChange, trendData, volumeData }: { bullishValue: number; rangeItemsLength: number; sentimentData: Array<{ color: string; name: string; value: number }>; sourceData: Array<{ color: string; name: string; value: number }>; timeRange: string; trendChange: number | null; trendData: Array<{ day: string; sentiment: number; total: number }>; volumeData: Array<{ articles: number; day: string }> }) {
  const t = useTranslations("analytics"), feedT = useTranslations("feed");
  return (
    <motion.section animate="visible" className="grid grid-cols-2 gap-4 lg:grid-cols-4" initial="hidden" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.09 } } }}>
      <MetricCard title={t("sentimentOverview")}><div className="relative flex items-center justify-center"><ResponsiveContainer height={160} width={160}><PieChart><Pie data={sentimentData} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={3} stroke="none">{sentimentData.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[32px] font-bold text-chart-1">{bullishValue}%</span><span className="text-xs text-muted-foreground">{feedT("sentiment.bullish")}</span></div></div></MetricCard>
      <MetricCard title={t("sentimentTrend")}><ResponsiveContainer height={100} width="100%"><AreaChart data={trendData}><defs><linearGradient id="sentimentGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs><Area dataKey="sentiment" fill="url(#sentimentGradient)" stroke="var(--chart-1)" strokeWidth={2} type="linear" /><Tooltip contentStyle={darkTooltipContentStyle} /></AreaChart></ResponsiveContainer>{trendChange === null ? <p className="mt-2 text-sm text-muted-foreground">{t("notAvailable")}</p> : <TrendLabel positive={trendChange >= 0} value={`${trendChange >= 0 ? "+" : ""}${trendChange}%`} />}</MetricCard>
      <MetricCard title={t("articleVolume")}><ResponsiveContainer height={100} width="100%"><BarChart data={volumeData}><Bar dataKey="articles" fill="var(--primary)" radius={[6, 6, 0, 0]} /><Tooltip contentStyle={darkTooltipContentStyle} /></BarChart></ResponsiveContainer><div className="mt-2 flex items-center justify-between"><span className="text-[24px] font-bold text-foreground">{rangeItemsLength}</span><span className="text-xs text-muted-foreground">{t("articlesInRange", { range: timeRange })}</span></div></MetricCard>
      <MetricCard title={t("sourceDistribution")}><div className="flex justify-center"><div className="flex items-center gap-[60px]"><div className="shrink-0"><ResponsiveContainer height={120} width={120}><PieChart><Pie data={sourceData} dataKey="value" innerRadius={35} outerRadius={50} paddingAngle={2} stroke="none">{sourceData.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Pie></PieChart></ResponsiveContainer></div><div className="min-w-0 flex-1 space-y-1.5">{sourceData.map((source) => <div className="flex items-center gap-1.5 text-xs" key={source.name}><div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: source.color }} /><span className="truncate text-muted-foreground">{source.name}</span><span className="shrink-0 font-bold text-foreground">{source.value}%</span></div>)}</div></div></div></MetricCard>
    </motion.section>
  );
}

export function CategorySection({ categoryData }: { categoryData: CategoryRow[] }) {
  const t = useTranslations("analytics");
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{t("sentimentByCategory")}</h2>
      <div className="grid gap-3">{categoryData.map((category) => <motion.div className="rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" key={category.raw} whileHover={{ y: -2 }}><div className="flex items-center justify-between gap-4"><div className="flex min-w-[140px] items-center gap-3"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: categoryColors[category.raw] }} /><span className="font-bold text-foreground">{category.name}</span></div><div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ backgroundColor: "var(--chart-1)", width: `${category.bullish}%` }} /><div className="h-full" style={{ backgroundColor: "var(--chart-2)", width: `${category.bearish}%` }} /><div className="h-full" style={{ backgroundColor: "var(--muted-foreground)", width: `${category.neutral}%` }} /></div><div className="flex min-w-[180px] items-center justify-end gap-4"><span className="text-sm text-muted-foreground">{t("articleCount", { count: category.articles })}</span><TrendLabel positive={category.trend >= 0} value={`${category.trend >= 0 ? "+" : ""}${category.trend}%`} /></div></div></motion.div>)}</div>
    </section>
  );
}

export function ReportsSection({ handleGenerateReport, isGenerating, paginatedReports, reportPage, selectedReport, setReportPage, setSelectedReport, totalReportPages }: { handleGenerateReport: () => void; isGenerating: boolean; paginatedReports: ReportSummary[]; reportPage: number; selectedReport: ReportSummary | null; setReportPage: (value: number | ((page: number) => number)) => void; setSelectedReport: (report: ReportSummary) => void; totalReportPages: number }) {
  const t = useTranslations("analytics");
  return (
    <section className="space-y-4" id="intelligence-reports">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-foreground">{t("reports")}</h2><motion.button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50" disabled={isGenerating} onClick={handleGenerateReport} type="button" whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}><Plus className="h-4 w-4" />{t("generateReport")}</motion.button></div>
      <div className="grid grid-cols-[1fr_1fr] gap-4"><div className="space-y-3">{paginatedReports.map((report) => <ReportListRow isSelected={selectedReport?.id === report.id} key={report.id} onSelect={() => setSelectedReport(report)} report={report} />)}{totalReportPages > 1 && <ReportPagination reportPage={reportPage} setReportPage={setReportPage} totalReportPages={totalReportPages} />}</div><ReportPreview report={selectedReport} /></div>
    </section>
  );
}

function ReportPagination({ reportPage, setReportPage, totalReportPages }: { reportPage: number; setReportPage: (value: number | ((page: number) => number)) => void; totalReportPages: number }) {
  const t = useTranslations("analytics");
  return <div className="flex items-center justify-center gap-2 pt-2"><button aria-label={t("previousReportsPage")} className="rounded-xl px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40" disabled={reportPage <= 1} onClick={() => setReportPage((page) => page - 1)} type="button">←</button><span className="text-sm text-muted-foreground">{reportPage} / {totalReportPages}</span><button aria-label={t("nextReportsPage")} className="rounded-xl px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40" disabled={reportPage >= totalReportPages} onClick={() => setReportPage((page) => page + 1)} type="button">→</button></div>;
}

export function KeywordsSection({ keywords }: { keywords: Keyword[] }) {
  const t = useTranslations("analytics");
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold text-foreground">{t("topKeywords")}</h2></div>
      <div className="flex flex-wrap gap-3">{keywords.map((keyword, index) => <motion.div animate={{ opacity: 1, scale: 1 }} className={cn("flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all", index < 3 ? "border border-primary/20 bg-primary/10 text-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")} initial={{ opacity: 0, scale: 0.9 }} key={keyword.keyword} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.05 }}><span className="text-muted-foreground">#</span><span>{keyword.keyword}</span><span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", index < 3 ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground")}>{keyword.count}</span></motion.div>)}</div>
    </section>
  );
}

function ReportListRow({ isSelected, onSelect, report }: { isSelected: boolean; onSelect: () => void; report: ReportSummary }) {
  const locale = useLocale(), t = useTranslations("analytics");
  const displayName = formatReportDisplayName(report, locale, t);
  const generatedDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(report.generated_at));
  return <motion.button animate={{ opacity: 1, y: 0 }} aria-pressed={isSelected} className={cn("group flex w-full items-stretch overflow-hidden rounded-2xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md", isSelected ? "border-primary bg-primary/5" : "border-border")} initial={{ opacity: 0, y: 12 }} onClick={onSelect} type="button" whileHover={{ y: -2 }}><div className={cn("w-1.5 shrink-0 rounded-l-2xl", reportTypeColors[report.report_type] ?? "bg-muted-foreground")} /><div className="grid min-w-0 flex-1 gap-3 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-foreground sm:text-base">{displayName}</h3><p className="mt-1 text-xs text-muted-foreground">{t("reportMeta", { count: report.item_count, minutes: readingTime(report.content) })}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="text-sm font-bold text-foreground">{generatedDate}</p><p className="text-xs text-muted-foreground">{formatRelative(report.generated_at, locale)}</p></div></div></div></motion.button>;
}

function ReportPreview({ report }: { report: ReportSummary | null }) {
  const locale = useLocale(), t = useTranslations("analytics");
  if (!report) return <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><FileText className="mb-3 h-8 w-8 text-muted-foreground" /><h3 className="text-base font-bold text-foreground">{t("selectReportPreview")}</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("selectReportPreviewDescription")}</p></div>;
  const displayName = formatReportDisplayName(report, locale, t);
  const subtitle = formatReportSubtitle(report, locale, t);
  const summary = extractExecutiveSummary(report.content);
  return <div className="flex min-h-[320px] flex-col rounded-2xl border border-border bg-card p-6"><div><h3 className="text-xl font-bold leading-tight text-foreground">{displayName}</h3><p className="mt-2 text-sm text-muted-foreground">{subtitle}</p><div className="mt-5"><p className="text-xs font-bold uppercase text-muted-foreground">{t("reportSummary")}</p><p className="mt-2 text-sm leading-6 text-foreground/75">{summary || t("reportSummaryFallback")}</p></div></div><div className="mt-auto flex justify-end pt-6"><Link className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90" href={`/${locale}/reports/${report.id}`}>{t("viewDetails")}</Link></div></div>;
}

function MetricCard({ children, title }: { children: ReactNode; title: string }) {
  return <motion.div className="rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} whileHover={{ y: -4 }}><h3 className="mb-4 text-[22px] font-bold text-foreground">{title}</h3>{children}</motion.div>;
}

function TrendLabel({ positive, value }: { positive: boolean; value: string }) {
  return <div className={cn("flex items-center gap-1 text-sm font-bold", positive ? "text-chart-1" : "text-chart-2")}>{positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}<span>{value}</span></div>;
}
