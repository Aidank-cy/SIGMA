import type { Category, ItemSummary, ReportSummary, Sentiment } from "@/lib/types";

export const timeRanges = ["24h", "7D", "14D", "30D"];
export const timeRangeDays: Record<string, number> = { "24h": 1, "7D": 7, "14D": 14, "30D": 30 };
export const categories: Category[] = ["politics", "finance", "technology", "macro"];
export const REPORTS_PER_PAGE = 4;

export const categoryColors: Record<string, string> = {
  finance: "var(--chart-1)",
  macro: "var(--chart-5)",
  other: "var(--muted-foreground)",
  politics: "var(--chart-3)",
  technology: "var(--chart-4)"
};

export const darkTooltipContentStyle = {
  backgroundColor: "var(--foreground)",
  border: "none",
  borderRadius: "16px",
  color: "var(--background)",
  fontSize: "13px",
  fontWeight: 700,
  padding: "10px 16px"
};

export const reportTypeColors: Record<string, string> = {
  daily: "bg-chart-1",
  daily_afternoon: "bg-chart-1",
  daily_morning: "bg-chart-1",
  monthly: "bg-amber-500",
  weekly: "bg-indigo-500"
};

export function inferSentiment(item: ItemSummary): Sentiment {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  const bearishPatterns = /\b(fall|falls|fell|drop|drops|dropped|risk|risks|bear|bearish|decline|declines|declined|weak|weaken|cut|cuts|pressure|loss|losses|crash|plunge|plunges|plunged|slump|slumps|tumble|tumbles|sink|sinks|sank|downturn|recession|layoff|layoffs|deficit|downgrade|downgrades|warning|sell-off|selloff|negative|slowdown|contraction|bankruptcy|default|crisis|fear|fears|inflation|tariff|tariffs|sanction|sanctions|volatility|uncertainty|debt|bubble)\b/;
  const bullishPatterns = /\b(rise|rises|rose|gain|gains|gained|bull|bullish|growth|grows|grew|beat|beats|strong|stronger|surge|surges|surged|record|upgrade|upgrades|rally|rallies|rallied|boom|booms|soar|soars|soared|jump|jumps|jumped|optimism|optimistic|profit|profits|profitable|recovery|recover|recovers|expansion|expand|expands|positive|upbeat|outperform|outperforms|breakout|breakthrough|innovation|milestone|dividend|buyback|ipo|stimulus)\b/;
  if (bearishPatterns.test(text)) return "bearish";
  if (bullishPatterns.test(text)) return "bullish";
  return "neutral";
}

export function formatRelative(date: string, locale: string) {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export function readingTime(content: string) {
  return Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 220));
}

export function extractExecutiveSummary(content: string): string {
  const pattern = /^##\s+Executive\s+Summary\s*\n([\s\S]*?)(?=\n##\s+|$)/im;
  const match = content.match(pattern);
  if (!match) return content.replace(/^#{1,6}\s+.*$/gm, "").replace(/[`*_~|]/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
  return match[1].replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*_~|]/g, "").replace(/\s+/g, " ").trim();
}

export function formatReportSubtitle(report: ReportSummary, locale: string, t: (key: string, values?: Record<string, string>) => string) {
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const fullDateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", hour12: false, minute: "2-digit" });
  const startDate = new Date(report.period_start), endDate = new Date(report.period_end), generatedDate = new Date(report.generated_at);
  return t("reportSubtitle", { endDate: fullDateFormatter.format(endDate), generatedDate: fullDateFormatter.format(generatedDate), generatedTime: timeFormatter.format(generatedDate), startDate: dateFormatter.format(startDate) });
}

export function formatReportDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(value));
}

export function formatReportMonth(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatReportDisplayName(report: ReportSummary, locale: string, t: (key: string, values?: Record<string, string>) => string) {
  const startDate = formatReportDate(report.period_start, locale);
  const endDate = formatReportDate(report.period_end, locale);
  if (report.report_type === "weekly") return t("reportNames.weekly", { end: endDate, start: startDate });
  if (report.report_type === "monthly") return t("reportNames.monthly", { month: formatReportMonth(report.period_start, locale) });
  return t(`reportNames.${report.report_type}`, { date: startDate });
}

export function buildWindowStart(currentTime: number, rangeDays: number) {
  const date = new Date(currentTime);
  if (rangeDays <= 1) date.setHours(date.getHours() - 24);
  else date.setDate(date.getDate() - rangeDays);
  return date.toISOString();
}

export function buildFetchStart(currentTime: number, rangeDays: number) {
  const date = new Date(currentTime);
  if (rangeDays <= 1) date.setHours(date.getHours() - 48);
  else date.setDate(date.getDate() - rangeDays * 2);
  return date.toISOString();
}

export function buildDailyVolume(items: ItemSummary[], locale: string, days = 7) {
  if (days <= 1) return buildHourlyVolume(items, locale);
  const counts = new Map<string, number>();
  const dateFormat: Intl.DateTimeFormatOptions = days <= 7 ? { weekday: "short" } : { month: "short", day: "numeric" };
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    counts.set(date.toISOString().slice(0, 10), 0);
  }
  items.forEach((item) => { const key = item.published_at.slice(0, 10); if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1); });
  return Array.from(counts.entries()).map(([day, articles]) => ({ articles, day: new Intl.DateTimeFormat(locale, dateFormat).format(new Date(`${day}T00:00:00Z`)) }));
}

export function buildHourlyVolume(items: ItemSummary[], locale: string) {
  const now = new Date(), counts = new Map<string, number>(), hourKeys: string[] = [];
  for (let offset = 23; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * 3600_000), key = date.toISOString().slice(0, 13);
    hourKeys.push(key);
    counts.set(key, 0);
  }
  items.forEach((item) => { const key = item.published_at.slice(0, 13); if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1); });
  return hourKeys.map((key) => ({ articles: counts.get(key) ?? 0, day: new Intl.DateTimeFormat(locale, { hour: "2-digit", hour12: false }).format(new Date(`${key}:00:00Z`)) }));
}

export function buildSourceData(items: ItemSummary[]) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item.source_name, (counts.get(item.source_name) ?? 0) + 1));
  const total = items.length || 1;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count], index) => ({ color: ["var(--chart-1)", "var(--chart-4)", "var(--chart-5)", "var(--primary)"][index], name, value: Math.round((count / total) * 100) }));
}

export function buildCategoryRows(items: ItemSummary[], t: (key: string) => string) {
  return categories.map((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    const sentiments = categoryItems.map(inferSentiment);
    const total = sentiments.length || 1;
    const bullish = Math.round((sentiments.filter((value) => value === "bullish").length / total) * 100);
    const bearish = Math.round((sentiments.filter((value) => value === "bearish").length / total) * 100);
    return { articles: categoryItems.length, bearish, bullish, name: t(`categories.${category}`), neutral: Math.max(0, 100 - bullish - bearish), raw: category, trend: bullish - bearish };
  });
}

export function buildSentimentData(items: ItemSummary[], fallbackBullishPct: number | undefined, t: (key: string) => string) {
  const itemSentiments = items.map(inferSentiment);
  const bullish = itemSentiments.length > 0 ? Math.round((itemSentiments.filter((value) => value === "bullish").length / itemSentiments.length) * 100) : Math.round(fallbackBullishPct ?? 0);
  const bearish = itemSentiments.length > 0 ? Math.round((itemSentiments.filter((value) => value === "bearish").length / itemSentiments.length) * 100) : 0;
  return [{ color: "var(--chart-1)", name: t("sentiment.bullish"), value: bullish }, { color: "var(--chart-2)", name: t("sentiment.bearish"), value: bearish }, { color: "var(--muted-foreground)", name: t("sentiment.neutral"), value: Math.max(0, 100 - bullish - bearish) }];
}

export function buildCurrentWindowSentiment(items: ItemSummary[]) {
  const total = items.length;
  const bullish = items.filter((item) => inferSentiment(item) === "bullish").length;
  return { sentiment: total > 0 ? Math.round((bullish / total) * 100) : 0, total };
}

export function buildTrendData(items: ItemSummary[], currentTime: number, rangeDays: number, locale: string) {
  const now = new Date(currentTime);
  const windowMs = rangeDays <= 1 ? 24 * 60 * 60 * 1000 : rangeDays * 24 * 60 * 60 * 1000;
  const numPoints = rangeDays <= 1 ? 24 : rangeDays <= 7 ? 28 : rangeDays <= 14 ? 28 : 30;
  const labelFormatter = rangeDays <= 1 ? new Intl.DateTimeFormat(locale, { hour: "2-digit", hour12: false, minute: "2-digit" }) : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return Array.from({ length: numPoints + 1 }, (_, index) => {
    const fraction = index / numPoints;
    const windowEnd = new Date(now.getTime() - windowMs * (1 - fraction));
    const windowStart = new Date(windowEnd.getTime() - windowMs);
    const windowItems = items.filter((item) => {
      const publishedAt = new Date(item.published_at).getTime();
      return publishedAt >= windowStart.getTime() && publishedAt <= windowEnd.getTime();
    });
    const total = windowItems.length;
    const bullish = windowItems.filter((item) => inferSentiment(item) === "bullish").length;
    return { day: labelFormatter.format(windowEnd), sentiment: total > 0 ? Math.round((bullish / total) * 100) : 0, total };
  });
}

export function buildTrendChange(trendData: Array<{ sentiment: number; total: number }>) {
  const withData = trendData.filter((point) => point.total > 0);
  if (withData.length < 2) return null;
  return withData[withData.length - 1].sentiment - withData[0].sentiment;
}
