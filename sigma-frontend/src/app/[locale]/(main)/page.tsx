"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { DashboardNewsByCategory } from "@/components/dashboard/dashboard-news";
import { RightSidebar } from "@/components/dashboard/right-sidebar";
import { ChartSkeleton, StatsSkeleton, TickerSkeleton } from "@/components/dashboard/skeletons";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import type { ItemFilters } from "@/lib/types";
import { formatUpdatedAt, getGreetingKey, type GreetingKey } from "@/lib/utils";

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
            <h1 className="text-balance text-[32px] font-bold text-foreground">
              {t(greetingKey, { name: user?.display_name ?? "SIGMA" })}
            </h1>
            <p className="mt-1 text-foreground/60">{t("subtitle")}</p>
          </div>
          {hasMarketData ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground/55">
                {t("lastUpdated")}: <span className="font-bold text-foreground">{updatedAt}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-chart-1" />
                <span className="text-xs font-bold text-chart-1">{t("live")}</span>
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
