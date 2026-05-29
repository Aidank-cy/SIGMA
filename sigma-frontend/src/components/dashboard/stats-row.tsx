"use client";

import { motion } from "framer-motion";
import { Database, FileText, Newspaper, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { useItems } from "@/hooks/useItems";
import { useReports } from "@/hooks/useReports";
import { useSentimentStats } from "@/hooks/useStats";
import { useSources } from "@/hooks/useSources";
import { cn } from "@/lib/utils";

const statStyles = [
  { bgColor: "bg-chart-3/10", color: "text-chart-3", icon: Newspaper },
  { bgColor: "bg-chart-1/10", color: "text-chart-1", icon: TrendingUp },
  { bgColor: "bg-chart-5/10", color: "text-chart-5", icon: Database },
  { bgColor: "bg-chart-4/10", color: "text-chart-4", icon: FileText }
];

function relativeTime(value: string, locale: string): string {
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return formatter.format(diffSeconds, "second");
}

export function StatsRow() {
  const t = useTranslations("feed.stats");
  const locale = useLocale();
  const router = useRouter();
  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }, []);
  const todayISO = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), []);
  const { data: todayData } = useItems({ date_from: todayStart, page_size: 1 });
  const { data: sentiment } = useSentimentStats();
  const { data: sourcesData } = useSources();
  const { data: reportsData } = useReports(undefined, 1);
  const activeSources = sourcesData?.items.filter((source) => source.is_active).length ?? 0;
  const latestReport = reportsData?.pages[0]?.items[0];
  const bullishPct = sentiment?.bullish_pct ?? 50;
  const stats = [
    {
      change: `+${todayData?.pages[0]?.items.length ?? 0}`,
      label: t("todayArticles"),
      target: `/${locale}/news?date_from=${encodeURIComponent(todayISO)}`,
      value: String(todayData?.pages[0]?.total ?? 0)
    },
    {
      change: `${bullishPct >= 50 ? "+" : "-"}${Math.abs(bullishPct - 50).toFixed(0)}%`,
      label: t("marketSentiment"),
      target: `/${locale}/analytics`,
      value: bullishPct >= 50 ? t("bullish", { value: bullishPct }) : t("bearish", { value: 100 - bullishPct })
    },
    {
      change: String(activeSources),
      label: t("activeSources"),
      target: `/${locale}/sync`,
      value: String(activeSources)
    },
    {
      change: latestReport ? t("new") : t("none"),
      label: t("latestReport"),
      target: `/${locale}/analytics#intelligence-reports`,
      value: latestReport ? relativeTime(latestReport.generated_at, locale) : t("none")
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const style = statStyles[index];
        const Icon = style.icon;
        return (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            key={stat.label}
            onClick={() => router.push(stat.target)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(stat.target);
              }
            }}
            role="button"
            tabIndex={0}
            transition={{ delay: index * 0.08, duration: 0.35 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center gap-4">
              <div className={cn("shrink-0 rounded-2xl p-3 transition-transform duration-200 group-hover:scale-110", style.bgColor)}>
                <Icon className={cn("h-6 w-6", style.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground">{stat.label}</p>
                <p className="text-[28px] font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                  {stat.value}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-2xl px-2.5 py-1 text-xs font-bold",
                  stat.change === t("new") ? "bg-primary/10 text-primary" : "bg-chart-1/10 text-chart-1"
                )}
              >
                {stat.change}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
