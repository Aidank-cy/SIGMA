"use client";

import { FileText, Hash, Star } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useReports } from "@/hooks/useReports";
import { useTrendingKeywords } from "@/hooks/useStats";
import { useWatchlists } from "@/hooks/useWatchlists";

export function HomeSidebar() {
  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        <WatchlistPreview />
        <TrendingTopics />
        <LatestReport />
      </div>
    </aside>
  );
}

function SidebarCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-[280px] snap-start rounded-2xl border border-sigma-line bg-sigma-surface p-4 lg:min-w-0">
      {children}
    </div>
  );
}

function WatchlistPreview() {
  const locale = useLocale();
  const t = useTranslations("feed.sidebar");
  const { data, isLoading } = useWatchlists();
  const watchlists = data?.items.slice(0, 3) ?? [];

  return (
    <SidebarCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-sigma-text">
          <Star className="h-4 w-4 text-sigma-accent" aria-hidden />
          {t("watchlist")}
        </h2>
        <Link className="inline-flex min-h-11 items-center text-xs font-semibold text-sigma-accent" href={`/${locale}/watchlist`}>
          {t("open")}
        </Link>
      </div>
      {isLoading ? <Skeleton className="h-24 rounded-xl" /> : null}
      {!isLoading && watchlists.length === 0 ? <p className="text-sm text-sigma-muted">{t("empty")}</p> : null}
      <div className="space-y-3">
        {watchlists.map((watchlist) => (
          <Link className="flex min-h-11 items-center justify-between gap-3 text-sm" href={`/${locale}/watchlist`} key={watchlist.id}>
            <span className="truncate font-medium text-sigma-text">{watchlist.name}</span>
            <span className="shrink-0 tabular-nums text-sigma-muted">{t("items", { count: watchlist.item_count })}</span>
          </Link>
        ))}
      </div>
    </SidebarCard>
  );
}

function TrendingTopics() {
  const t = useTranslations("feed.sidebar");
  const { data, isLoading } = useTrendingKeywords();
  const keywords = data?.items ?? [];

  return (
    <SidebarCard>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-sigma-text">
        <Hash className="h-4 w-4 text-sigma-accent" aria-hidden />
        {t("trending")}
      </h2>
      {isLoading ? <Skeleton className="h-24 rounded-xl" /> : null}
      {!isLoading && keywords.length === 0 ? <p className="text-sm text-sigma-muted">{t("empty")}</p> : null}
      <div className="space-y-3">
        {keywords.map((item) => (
          <div className="flex items-center justify-between gap-3 text-sm" key={item.keyword}>
            <span className="truncate font-medium text-sigma-text">{item.keyword}</span>
            <span className="tabular-nums text-sigma-muted">{item.count}</span>
          </div>
        ))}
      </div>
    </SidebarCard>
  );
}

function LatestReport() {
  const locale = useLocale();
  const t = useTranslations("feed.sidebar");
  const { data, isLoading } = useReports(undefined, 1);
  const report = data?.pages[0]?.items[0];

  return (
    <SidebarCard>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-sigma-text">
        <FileText className="h-4 w-4 text-sigma-accent" aria-hidden />
        {t("latestReport")}
      </h2>
      {isLoading ? <Skeleton className="h-24 rounded-xl" /> : null}
      {!isLoading && !report ? <p className="text-sm text-sigma-muted">{t("empty")}</p> : null}
      {report ? (
        <Link className="block min-h-11" href={`/${locale}/reports/${report.id}`}>
          <Badge>{t(`reportTypes.${report.report_type}`)}</Badge>
          <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-sigma-text">{report.title}</p>
        </Link>
      ) : null}
    </SidebarCard>
  );
}
