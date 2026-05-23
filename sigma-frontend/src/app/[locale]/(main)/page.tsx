"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { RightSidebar } from "@/components/dashboard/right-sidebar";
import { useItemsPaginated } from "@/hooks/useItems";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import type { Category, ItemFilters, ItemSummary } from "@/lib/types";

const HeroChart = dynamic(() => import("@/components/dashboard/hero-chart").then((mod) => mod.HeroChart), {
  loading: () => <ChartSkeleton />,
  ssr: false
});
const StatsRow = dynamic(() => import("@/components/dashboard/stats-row").then((mod) => mod.StatsRow), {
  loading: () => <StatsSkeleton />,
  ssr: false
});
const TickerCarousel = dynamic(() => import("@/components/dashboard/ticker-carousel").then((mod) => mod.TickerCarousel), {
  loading: () => <TickerSkeleton />,
  ssr: false
});

type DashboardNewsColumnKey = "politics" | "economy" | "finance" | "macro";

const dashboardNewsColumns: Array<{ category: Category; key: DashboardNewsColumnKey }> = [
  { category: "politics", key: "politics" },
  { category: "technology", key: "economy" },
  { category: "finance", key: "finance" },
  { category: "macro", key: "macro" }
];

type GreetingKey =
  | "greetingMorning"
  | "greetingNoon"
  | "greetingAfternoon"
  | "greetingEvening"
  | "greetingNight";

function getGreetingKey(): GreetingKey {
  const now = new Date();
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

  if (minutesSinceMidnight >= 6 * 60 && minutesSinceMidnight < 12 * 60) {
    return "greetingMorning";
  }
  if (minutesSinceMidnight >= 12 * 60 && minutesSinceMidnight < 12 * 60 + 30) {
    return "greetingNoon";
  }
  if (minutesSinceMidnight >= 12 * 60 + 30 && minutesSinceMidnight < 18 * 60 + 30) {
    return "greetingAfternoon";
  }
  if (minutesSinceMidnight >= 18 * 60 + 30) {
    return "greetingEvening";
  }
  return "greetingNight";
}

function formatUpdatedAt(timestamp: string | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function ChartSkeleton() {
  return <div className="h-[408px] rounded-2xl border border-border bg-card/70 animate-pulse lg:h-[488px]" />;
}

function TickerSkeleton() {
  return (
    <div className="h-full rounded-xl border border-border bg-card/70 p-4">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="mb-3 h-14 rounded-lg bg-muted/60 animate-pulse" key={index} />
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="h-[154px] rounded-xl border border-border bg-card/70 animate-pulse" key={index} />
      ))}
    </div>
  );
}

function DashboardNewsByCategory({ baseFilters }: { baseFilters: ItemFilters }) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const politics = useItemsPaginated({ ...baseFilters, category: "politics", page_size: 4 }, 1);
  const economy = useItemsPaginated({ ...baseFilters, category: "technology", page_size: 4 }, 1);
  const finance = useItemsPaginated({ ...baseFilters, category: "finance", page_size: 4 }, 1);
  const macro = useItemsPaginated({ ...baseFilters, category: "macro", page_size: 4 }, 1);
  const queries = { economy, finance, macro, politics };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-foreground">{t("latestNews")}</h2>
        <Link className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href={`/${locale}/news`}>
          {t("viewAll")}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {dashboardNewsColumns.map((column) => (
          <DashboardNewsColumn
            category={column.category}
            items={sortByPublishedAt(queries[column.key].data?.items ?? []).slice(0, 4)}
            isLoading={queries[column.key].isLoading}
            key={column.key}
            title={t(`newsColumns.${column.key}`)}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardNewsColumn({
  category,
  isLoading,
  items,
  title
}: {
  category: Category;
  isLoading: boolean;
  items: ItemSummary[];
  title: string;
}) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const feedT = useTranslations("feed");

  return (
    <div className="flex min-h-[260px] flex-col rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-1 flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="h-10 animate-pulse rounded-lg bg-muted" key={index} />
          ))
        ) : items.length > 0 ? (
          items.map((item) => (
            <Link
              className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              href={`/${locale}/items/${item.id}`}
              key={item.id}
            >
              <span className="block line-clamp-1">{item.title}</span>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{feedT("empty")}</p>
        )}
      </div>
      <Link
        className="mt-4 self-end text-sm font-semibold text-primary hover:underline"
        href={`/${locale}/news?category=${category}`}
      >
        {t("viewDetails")}
      </Link>
    </div>
  );
}

function sortByPublishedAt(items: ItemSummary[]): ItemSummary[] {
  return [...items].sort((left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime());
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const { data: marketData } = useMarketIndices();
  const [greetingKey, setGreetingKey] = useState<GreetingKey>("greetingMorning");
  const [activeMarket, setActiveMarket] = useState("");
  const filters = useMemo<ItemFilters>(
    () => ({
      page_size: 18
    }),
    []
  );

  useEffect(() => {
    setGreetingKey(getGreetingKey());
  }, []);

  useEffect(() => {
    const indices = marketData?.indices ?? [];
    if (indices.length > 0 && !indices.some((index) => index.symbol === activeMarket)) {
      setActiveMarket(indices[0].symbol);
    }
  }, [activeMarket, marketData]);

  const marketUpdatedAt = marketData && "updated_at" in marketData ? marketData.updated_at : null;
  const updatedAt = formatUpdatedAt(marketUpdatedAt) ?? t("live");
  const hasMarketData = marketData !== undefined;

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1 space-y-8 p-6 lg:p-8">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          initial={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div>
            <h1 className="text-balance text-2xl font-bold text-foreground lg:text-3xl">
              {t(greetingKey, { name: user?.display_name ?? "SIGMA" })}
            </h1>
            <p className="mt-1 text-foreground/60">{t("subtitle")}</p>
          </div>
          {hasMarketData ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground/55">
                {t("lastUpdated")}: <span className="font-medium text-foreground">{updatedAt}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-chart-1" />
                <span className="text-xs font-medium text-chart-1">{t("live")}</span>
              </div>
            </div>
          ) : (
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
          )}
        </motion.div>

        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6 lg:grid lg:grid-cols-[3fr_1fr]"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div>
            <HeroChart activeMarket={activeMarket} onActiveMarketChange={setActiveMarket} />
          </div>
          <div className="relative min-h-0 lg:overflow-hidden">
            <div className="lg:absolute lg:inset-0">
              <TickerCarousel activeMarket={activeMarket} onSelectMarket={setActiveMarket} />
            </div>
          </div>
        </motion.section>

        <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <StatsRow />
        </motion.section>

        <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.5, duration: 0.4 }}>
          <DashboardNewsByCategory baseFilters={filters} />
        </motion.section>
      </div>

      <aside className="hidden w-80 shrink-0 p-6 pl-0 lg:p-8 lg:pl-0 xl:block">
        <div className="sticky top-6">
          <RightSidebar />
        </div>
      </aside>
    </div>
  );
}
