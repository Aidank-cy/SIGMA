"use client";

import { Filter, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { MarketTickerCarousel } from "@/components/MarketTickerCarousel";
import { MarketIndexChart } from "@/components/charts/MarketIndexChart";
import { FeaturedStory } from "@/components/feed/FeaturedStory";
import { ItemCard } from "@/components/feed/ItemCard";
import { HomeSidebar } from "@/components/sidebar/HomeSidebar";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { useItems } from "@/hooks/useItems";
import { useReports } from "@/hooks/useReports";
import { useSentimentStats } from "@/hooks/useStats";
import { useSources } from "@/hooks/useSources";
import type { Category, ItemFilters, ItemSummary, Market } from "@/lib/types";

const categories: Category[] = ["politics", "finance", "technology", "macro"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu"];

export default function HomePage() {
  const t = useTranslations("feed");
  const [category, setCategory] = useState<Category | "">("");
  const [market, setMarket] = useState<Market | "">("");
  const [keyword, setKeyword] = useState("");
  const { data: featuredData } = useItems({ page_size: 1 });
  const featuredItem = featuredData?.pages[0]?.items[0];

  const filters = useMemo<ItemFilters>(
    () => ({
      category: category || undefined,
      keyword: keyword.trim() || undefined,
      market: market || undefined,
      page_size: 20
    }),
    [category, keyword, market]
  );

  return (
    <section className="flex flex-col gap-6">
      <MarketIndexChart />
      <StatsRow />
      <MarketTickerCarousel />
      {featuredItem ? <FeaturedStory item={featuredItem} /> : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <TimelineView
          category={category}
          excludedItemId={featuredItem?.id}
          filters={filters}
          keyword={keyword}
          market={market}
          setCategory={setCategory}
          setKeyword={setKeyword}
          setMarket={setMarket}
        />
        <HomeSidebar />
      </div>
      <h1 className="sr-only">{t("title")}</h1>
    </section>
  );
}

function StatsRow() {
  const t = useTranslations("feed.stats");
  const locale = useLocale();
  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }, []);
  const { data: todayData, isLoading: isItemsLoading } = useItems({ date_from: todayStart, page_size: 1 });
  const { data: sentiment, isLoading: isSentimentLoading } = useSentimentStats();
  const { data: sourcesData, isLoading: isSourcesLoading } = useSources();
  const { data: reportsData, isLoading: isReportsLoading } = useReports(undefined, 1);
  const activeSources = sourcesData?.items.filter((source) => source.is_active).length;
  const latestReport = reportsData?.pages[0]?.items[0];
  const bullishPct = sentiment?.bullish_pct ?? 50;
  const sentimentLabel = bullishPct >= 50
    ? t("bullish", { value: bullishPct })
    : t("bearish", { value: 100 - bullishPct });

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricCard isLoading={isItemsLoading} label={t("todayArticles")} value={String(todayData?.pages[0]?.total ?? 0)} />
      <MetricCard
        className={bullishPct >= 50 ? "text-sigma-success" : "text-sigma-danger"}
        isLoading={isSentimentLoading}
        label={t("marketSentiment")}
        value={sentimentLabel}
      />
      <MetricCard isLoading={isSourcesLoading} label={t("activeSources")} value={String(activeSources ?? 0)} />
      <MetricCard
        isLoading={isReportsLoading}
        label={t("latestReport")}
        value={latestReport ? relativeTime(latestReport.generated_at, locale) : t("none")}
      />
    </div>
  );
}

function MetricCard({
  className,
  isLoading,
  label,
  value
}: {
  className?: string;
  isLoading: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-sigma-elevated p-4">
      <p className="text-xs font-medium text-sigma-muted">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className={`mt-2 text-2xl font-semibold tabular-nums text-sigma-text ${className ?? ""}`}>{value}</p>
      )}
    </div>
  );
}

interface TimelineViewProps {
  category: Category | "";
  excludedItemId?: string;
  filters: ItemFilters;
  keyword: string;
  market: Market | "";
  setCategory: (value: Category | "") => void;
  setKeyword: (value: string) => void;
  setMarket: (value: Market | "") => void;
}

function TimelineView({
  category,
  excludedItemId,
  filters,
  keyword,
  market,
  setCategory,
  setKeyword,
  setMarket
}: TimelineViewProps) {
  const t = useTranslations("feed");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useItems(filters);
  const items = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item): item is ItemSummary => item.id !== excludedItemId
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 rounded-2xl border border-sigma-line bg-sigma-elevated p-3 md:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sigma-muted" />
          <input
            className="h-11 w-full rounded-full border border-sigma-line bg-sigma-bg pl-11 pr-4 text-sm text-sigma-text outline-none focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("search")}
            value={keyword}
          />
        </label>
        <FilterSelect
          label={t("categoryFilter")}
          onChange={(value) => setCategory(value as Category | "")}
          options={categories.map((value) => ({ label: t(`categories.${value}`), value }))}
          value={category}
        />
        <FilterSelect
          label={t("marketFilter")}
          onChange={(value) => setMarket(value as Market | "")}
          options={markets.map((value) => ({ label: t(`markets.${value}`), value }))}
          value={market}
        />
      </div>

      {isLoading ? <TimelineSkeleton /> : null}
      {!isLoading && items.length === 0 ? <EmptyState /> : null}
      {items.map((item, index) => (
        <ItemCard index={index} item={item} key={item.id} />
      ))}
      <div ref={sentinelRef} />
      {isFetchingNextPage ? <TimelineSkeleton rows={2} /> : null}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}

function FilterSelect({ label, onChange, options, value }: FilterSelectProps) {
  const t = useTranslations("feed");

  return (
    <CustomSelect
      label={label}
      leadingIcon={<Filter className="h-4 w-4" aria-hidden />}
      onChange={onChange}
      options={[{ label: t("all"), value: "" }, ...options]}
      selectClassName="bg-sigma-bg"
      value={value}
    />
  );
}

function TimelineSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="space-y-3 border-b border-sigma-line py-3" key={index}>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("feed");

  return (
    <div className="rounded-2xl border border-dashed border-sigma-line p-10 text-center text-sigma-muted">
      {t("empty")}
    </div>
  );
}

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
