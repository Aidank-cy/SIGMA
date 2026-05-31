"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { useItems } from "@/hooks/useItems";
import { useReports } from "@/hooks/useReports";
import { useSentimentStats, useTrendingKeywords } from "@/hooks/useStats";
import { apiFetch } from "@/lib/api";
import type { ReportSummary } from "@/lib/types";

import { AnalyticsHeader, CategorySection, KeywordsSection, MetricsOverview, ReportsSection } from "./AnalyticsPageParts";
import { REPORTS_PER_PAGE, buildCategoryRows, buildCurrentWindowSentiment, buildDailyVolume, buildFetchStart, buildSentimentData, buildSourceData, buildTrendChange, buildTrendData, buildWindowStart, categories, timeRangeDays } from "./AnalyticsPageUtils";

type Mutate = () => unknown;

export function AnalyticsPageContent() {
  const locale = useLocale();
  const state = useAnalyticsData(locale);
  const handleGenerateReport = useGenerateReport(locale, state.mutateReports, state.setIsGenerating);
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <AnalyticsHeader setTimeRange={state.setTimeRange} timeRange={state.timeRange} />
      <MetricsOverview bullishValue={state.bullishValue} rangeItemsLength={state.rangeItems.length} sentimentData={state.sentimentData} sourceData={state.sourceData} timeRange={state.timeRange} trendChange={state.trendChange} trendData={state.trendData} volumeData={state.volumeData} />
      <CategorySection categoryData={state.categoryData} />
      <ReportsSection handleGenerateReport={handleGenerateReport} isGenerating={state.isGenerating} paginatedReports={state.paginatedReports} reportPage={state.reportPage} selectedReport={state.selectedReport} setReportPage={state.setReportPage} setSelectedReport={state.setSelectedReport} totalReportPages={state.totalReportPages} />
      <KeywordsSection keywords={state.keywords.data?.items ?? []} />
    </div>
  );
}

function useAnalyticsData(locale: string) {
  const feedT = useTranslations("feed");
  const [timeRange, setTimeRange] = useState("7D"), [selectedReport, setSelectedReport] = useState<ReportSummary | null>(null);
  const [reportPage, setReportPage] = useState(1), [isGenerating, setIsGenerating] = useState(false), [currentTime, setCurrentTime] = useState(() => Date.now());
  const rangeDays = useMemo(() => timeRangeDays[timeRange] ?? 7, [timeRange]);
  const dateFrom = useMemo(() => buildWindowStart(currentTime, rangeDays), [currentTime, rangeDays]);
  const dataFetchFrom = useMemo(() => buildFetchStart(currentTime, rangeDays), [currentTime, rangeDays]);
  const sentiment = useSentimentStats(rangeDays), keywords = useTrendingKeywords(rangeDays), itemQuery = useItems({ date_from: dataFetchFrom, page_size: 500 }), reportsQuery = useReports(undefined, 50);
  const { data: itemData, fetchNextPage, hasNextPage, isFetchingNextPage, mutate: mutateItems } = itemQuery;
  const { mutate: mutateSentiment } = sentiment;
  const items = useMemo(() => itemData?.pages.flatMap((page) => page.items) ?? [], [itemData]);
  const rangeItems = useMemo(() => {
    const startTime = new Date(dateFrom).getTime();
    return items.filter((item) => {
      const publishedAt = new Date(item.published_at).getTime();
      return publishedAt >= startTime && publishedAt <= currentTime;
    });
  }, [currentTime, dateFrom, items]);
  const reports = useMemo(() => {
    const all = reportsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    return all.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  }, [reportsQuery.data]);
  const totalReportPages = Math.ceil(reports.length / REPORTS_PER_PAGE);
  const paginatedReports = reports.slice((reportPage - 1) * REPORTS_PER_PAGE, reportPage * REPORTS_PER_PAGE);
  useEffect(() => { if (selectedReport && !reports.some((report) => report.id === selectedReport.id)) setSelectedReport(null); }, [reports, selectedReport]);
  useEffect(() => { setReportPage(1); }, [reports.length]);
  useEffect(() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }, [fetchNextPage, hasNextPage, isFetchingNextPage, itemData?.pages.length]);
  useEffect(() => {
    const interval = window.setInterval(() => { setCurrentTime(Date.now()); mutateItems(); mutateSentiment(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [mutateItems, mutateSentiment]);
  const sentimentData = useMemo(() => buildSentimentData(rangeItems, sentiment.data?.bullish_pct, feedT), [feedT, rangeItems, sentiment.data?.bullish_pct]);
  const bullishValue = useMemo(() => buildCurrentWindowSentiment(rangeItems).sentiment, [rangeItems]);
  const trendData = useMemo(() => buildTrendData(items, currentTime, rangeDays, locale), [currentTime, items, locale, rangeDays]);
  const trendChange = useMemo(() => buildTrendChange(trendData), [trendData]);
  const volumeData = useMemo(() => buildDailyVolume(rangeItems, locale, rangeDays), [rangeItems, locale, rangeDays]);
  const sourceData = useMemo(() => buildSourceData(rangeItems), [rangeItems]);
  const categoryData = useMemo(() => buildCategoryRows(rangeItems, feedT), [feedT, rangeItems]);
  return { bullishValue, categoryData, isGenerating, keywords, mutateReports: reportsQuery.mutate, paginatedReports, rangeItems, reportPage, selectedReport, sentimentData, setIsGenerating, setReportPage, setSelectedReport, setTimeRange, sourceData, timeRange, totalReportPages, trendChange, trendData, volumeData };
}

function useGenerateReport(locale: string, mutateReports: Mutate, setIsGenerating: (value: boolean) => void) {
  const t = useTranslations("analytics"), { user } = useAuth(), { showToast } = useToast();
  async function handleGenerateReport() {
    if (user?.role !== "admin") { showToast(t("adminOnly"), "error"); return; }
    setIsGenerating(true);
    const periodEnd = new Date(), periodStart = new Date();
    periodStart.setDate(periodEnd.getDate() - 1);
    try {
      await apiFetch("/reports/generate", { body: JSON.stringify({ category_scope: categories, locale, market_scope: ["us", "cn", "hk", "jp", "eu", "global"], period_end: periodEnd.toISOString().slice(0, 10), period_start: periodStart.toISOString().slice(0, 10), report_type: "daily" }), method: "POST" });
      showToast(t("generationQueued"), "success");
      mutateReports();
    } catch { showToast(t("generationError"), "error"); }
    finally { setIsGenerating(false); }
  }
  return handleGenerateReport;
}
