"use client";

import { motion, useInView } from "framer-motion";
import { ArrowUpRight, Bookmark, Clock } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useItems } from "@/hooks/useItems";
import type { Category, ItemFilters, ItemSummary, Sentiment } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryGradients: Record<Category, string> = {
  finance: "from-emerald-600/80 via-emerald-500/60 to-emerald-400/40",
  macro: "from-amber-500/80 via-amber-400/60 to-amber-300/40",
  other: "from-slate-600/80 via-slate-500/60 to-slate-400/40",
  politics: "from-indigo-600/80 via-indigo-500/60 to-indigo-400/40",
  technology: "from-purple-600/80 via-purple-500/60 to-purple-400/40"
};

function inferSentiment(item: ItemSummary): Sentiment {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  if (/\b(drop|fall|risk|warning|slump|cut|loss|bear)\b/.test(text)) return "bearish";
  if (/\b(rise|gain|growth|rally|strong|beat|bull)\b/.test(text)) return "bullish";
  return "neutral";
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

function NewsCard({ index, item }: { index: number; item: ItemSummary }) {
  const locale = useLocale();
  const t = useTranslations("feed");
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-50px", once: true });
  const sentiment = inferSentiment(item);

  return (
    <motion.article
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      className="group overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
      initial={{ opacity: 0, y: 40 }}
      ref={ref}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
    >
      <div className={cn("relative h-44 overflow-hidden bg-gradient-to-br", categoryGradients[item.category])}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm",
              sentiment === "bullish"
                ? "bg-chart-1/25 text-chart-1"
                : sentiment === "bearish"
                  ? "bg-chart-2/25 text-chart-2"
                  : "bg-white/20 text-white"
            )}
          >
            {t(`categories.${item.category}`)}
          </span>
          <motion.button
            aria-label="Bookmark"
            className="rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Bookmark className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      <div className="p-5">
        <Link href={`/${locale}/items/${item.id}`}>
          <h3 className="mb-2 line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {item.title}
          </h3>
        </Link>
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {item.summary ?? t("summaryFallback")}
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate font-semibold text-foreground/80">{item.source_name || t("sourceFallback")}</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="flex shrink-0 items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(item.published_at, locale)}
            </span>
          </div>
          <Link
            aria-label={item.title}
            className="rounded-full p-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
            href={`/${locale}/items/${item.id}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export function NewsFeed({ filters }: { filters: ItemFilters }) {
  const t = useTranslations("dashboard");
  const feedT = useTranslations("feed");
  const locale = useLocale();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useItems(filters);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t("latestNews")}</h2>
        <Link className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href={`/${locale}/news`}>
          {t("viewAll")}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-80 animate-pulse rounded-xl border border-border bg-card" key={index} />
          ))}
        </div>
      ) : null}
      {!isLoading && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {feedT("empty")}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <NewsCard index={index} item={item} key={item.id} />
        ))}
      </div>
      <div ref={sentinelRef} />
      {isFetchingNextPage ? (
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="h-80 animate-pulse rounded-xl border border-border bg-card" key={index} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
