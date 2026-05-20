"use client";

import { motion } from "framer-motion";
import { Flame, Hash, MoreHorizontal, Plus, Star, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { useMarketIndices } from "@/hooks/useMarketIndices";
import { useTrendingKeywords } from "@/hooks/useStats";
import { useWatchlistItems, useWatchlists } from "@/hooks/useWatchlists";
import { cn } from "@/lib/utils";

export function RightSidebar() {
  const locale = useLocale();
  const t = useTranslations("sidebar");
  const { data: watchlists } = useWatchlists();
  const firstWatchlist = watchlists?.items[0] ?? null;
  const { data: watchlistItems } = useWatchlistItems(firstWatchlist?.id ?? null);
  const { data: trending } = useTrendingKeywords();
  const { data: marketData } = useMarketIndices();
  const items = watchlistItems?.pages[0]?.items.slice(0, 5) ?? [];
  const markets = marketData?.indices.slice(0, 4) ?? [];

  return (
    <div className="space-y-6">
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="rounded-xl border border-border bg-card p-5"
        initial={{ opacity: 0, x: 20 }}
        transition={{ delay: 0.2 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-chart-4" />
            <h3 className="font-semibold text-foreground">{t("watchlist")}</h3>
          </div>
          <div className="flex items-center gap-1">
            <motion.button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Plus className="h-4 w-4" />
            </motion.button>
            <motion.button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <MoreHorizontal className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <div className="space-y-1">
          {items.map((item, index) => (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="group flex cursor-pointer items-center justify-between rounded-xl p-3 transition-all duration-200"
              initial={{ opacity: 0, x: 20 }}
              key={item.id}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileHover={{ backgroundColor: "var(--muted)", x: 4 }}
            >
              <Link className="min-w-0 flex-1" href={`/${locale}/items/${item.id}`}>
                <p className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                  {item.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{item.source_name}</p>
              </Link>
            </motion.div>
          ))}
          {items.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
        </div>

        <Link
          className="mt-4 block w-full rounded-xl py-2.5 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          href={`/${locale}/markets`}
        >
          {t("viewPortfolio")}
        </Link>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="rounded-xl border border-border bg-card p-5"
        initial={{ opacity: 0, x: 20 }}
        transition={{ delay: 0.3 }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-chart-2" />
          <h3 className="font-semibold text-foreground">{t("trending")}</h3>
        </div>

        <div className="space-y-1">
          {(trending?.items ?? []).slice(0, 6).map((topic, index) => (
            <motion.button
              animate={{ opacity: 1, x: 0 }}
              className="group flex w-full items-center justify-between rounded-xl p-3 transition-all duration-200"
              initial={{ opacity: 0, x: 20 }}
              key={topic.keyword}
              transition={{ delay: 0.4 + index * 0.05 }}
              type="button"
              whileHover={{ backgroundColor: "var(--muted)", x: 4 }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                  {topic.keyword}
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{topic.count}</span>
            </motion.button>
          ))}
          {(trending?.items ?? []).length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
        </div>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5"
        initial={{ opacity: 0, x: 20 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="mb-4 font-semibold text-foreground">{t("marketOverview")}</h3>
        <div className="grid grid-cols-2 gap-4">
          {markets.map((market) => {
            const positive = market.change_pct >= 0;
            return (
              <div className="rounded-lg bg-background/50 p-3" key={market.symbol}>
                <p className="mb-1 truncate text-xs text-muted-foreground">{market.symbol}</p>
                <p className="text-xl font-bold text-foreground">
                  {market.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </p>
                <p className={cn("flex items-center gap-1 text-xs font-medium", positive ? "text-chart-1" : "text-chart-2")}>
                  {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {positive ? "+" : ""}
                  {market.change_pct.toFixed(2)}%
                </p>
              </div>
            );
          })}
          {markets.length === 0 ? (
            <p className="col-span-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
