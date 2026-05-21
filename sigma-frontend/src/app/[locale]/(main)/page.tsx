"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
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

function ChartSkeleton() {
  return <div className="h-[408px] rounded-2xl border border-border bg-card/70 animate-pulse lg:h-[488px]" />;
}

function TickerSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden px-8 py-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="h-[118px] min-w-[190px] rounded-xl border border-border bg-card/70 animate-pulse" key={index} />
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
  const locale = useLocale();
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
  const updatedAt = marketUpdatedAt
    ? new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
        Math.round((new Date(marketUpdatedAt).getTime() - Date.now()) / 60000),
        "minute"
      )
    : t("live");

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
            <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {t("lastUpdated")}: <span className="font-medium text-foreground">{updatedAt}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-chart-1" />
              <span className="text-xs font-medium text-chart-1">{t("live")}</span>
            </div>
          </div>
        </motion.div>

        <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <HeroChart />
        </motion.section>

        <motion.section animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">{t("marketMovers")}</h2>
          <TickerCarousel />
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
