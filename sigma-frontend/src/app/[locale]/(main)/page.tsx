"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { NewsFeed } from "@/components/dashboard/news-feed";
import { RightSidebar } from "@/components/dashboard/right-sidebar";
import { SearchBar } from "@/components/dashboard/search-bar";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import type { Category, ItemFilters, Market } from "@/lib/types";

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

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const { data: marketData } = useMarketIndices();
  const [category, setCategory] = useState<Category | "">("");
  const [greetingKey, setGreetingKey] = useState<GreetingKey>("greetingMorning");
  const [market, setMarket] = useState<Market | "">("");
  const [query, setQuery] = useState("");
  const filters = useMemo<ItemFilters>(
    () => ({
      category: category || undefined,
      keyword: query.trim() || undefined,
      market: market || undefined,
      page_size: 18
    }),
    [category, market, query]
  );

  useEffect(() => {
    setGreetingKey(getGreetingKey());
  }, []);

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
          className="flex flex-col gap-6 lg:flex-row"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="lg:w-3/4">
            <HeroChart />
          </div>
          <div className="lg:w-1/4">
            <TickerCarousel />
          </div>
        </motion.section>

        <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <StatsRow />
        </motion.section>

        <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <SearchBar
            category={category}
            market={market}
            query={query}
            setCategory={setCategory}
            setMarket={setMarket}
            setQuery={setQuery}
          />
        </motion.section>

        <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.5, duration: 0.4 }}>
          <NewsFeed filters={filters} />
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
