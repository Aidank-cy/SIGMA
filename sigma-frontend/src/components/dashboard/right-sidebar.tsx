"use client";

import { motion } from "framer-motion";
import { Flame, Hash, MoreHorizontal, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { useTrendingKeywords } from "@/hooks/useStats";
import { useWatchlistItems, useWatchlists } from "@/hooks/useWatchlists";

export function RightSidebar() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("sidebar");
  const { data: watchlists } = useWatchlists();
  const firstWatchlist = watchlists?.items[0] ?? null;
  const { data: watchlistItems } = useWatchlistItems(firstWatchlist?.id ?? null);
  const { data: trending } = useTrendingKeywords();
  const items = watchlistItems?.pages[0]?.items.slice(0, 5) ?? [];

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
                <p className="truncate text-xs text-foreground/55">{item.source_name}</p>
              </Link>
            </motion.div>
          ))}
          {items.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-foreground/60">{t("empty")}</p>
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
              onClick={() => router.push(`/${locale}/news?keyword=${encodeURIComponent(topic.keyword)}`)}
              transition={{ delay: 0.4 + index * 0.05 }}
              type="button"
              whileHover={{ backgroundColor: "var(--muted)", x: 4 }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                  {topic.keyword.charAt(0).toUpperCase() + topic.keyword.slice(1)}
                </span>
              </div>
              <span className="text-xs font-medium text-foreground/55">{topic.count}</span>
            </motion.button>
          ))}
          {(trending?.items ?? []).length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-foreground/60">{t("empty")}</p>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
