"use client";

import { motion, useInView } from "framer-motion";
import { ArrowUpRight, Bookmark, Clock } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import type { Category, ItemSummary, Sentiment } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryGradients: Record<Category, string> = {
  finance: "from-emerald-600/80 via-emerald-500/60 to-emerald-400/40",
  macro: "from-amber-500/80 via-amber-400/60 to-amber-300/40",
  other: "from-slate-600/80 via-slate-500/60 to-slate-400/40",
  politics: "from-indigo-600/80 via-indigo-500/60 to-indigo-400/40",
  technology: "from-purple-600/80 via-purple-500/60 to-purple-400/40"
};

interface NewsCardProps {
  bookmarked: boolean;
  index: number;
  item: ItemSummary;
  onToggleBookmark: (itemId: string) => void;
}

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

export function NewsCard({ bookmarked, index, item, onToggleBookmark }: NewsCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-50px", once: true });

  return (
    <motion.article
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      initial={{ opacity: 0, y: 40 }}
      ref={ref}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
    >
      <NewsCardMedia bookmarked={bookmarked} item={item} onToggleBookmark={onToggleBookmark} />
      <NewsCardBody item={item} />
    </motion.article>
  );
}

function NewsCardMedia({ bookmarked, item, onToggleBookmark }: Omit<NewsCardProps, "index">) {
  const t = useTranslations("feed");
  const sentiment = inferSentiment(item);

  return (
    <div className={cn("relative h-44 overflow-hidden bg-gradient-to-br", categoryGradients[item.category])}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", sentimentClassName(sentiment))}>
          {t(`categories.${item.category}`)}
        </span>
        <motion.button
          aria-label="Bookmark"
          className={cn(
            "rounded-full p-2 transition-colors",
            bookmarked ? "bg-primary/80 text-primary-foreground" : "bg-black/30 text-white hover:bg-white/30"
          )}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleBookmark(item.id);
          }}
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Bookmark className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} />
        </motion.button>
      </div>
    </div>
  );
}

function NewsCardBody({ item }: { item: ItemSummary }) {
  const locale = useLocale();
  const t = useTranslations("feed");

  return (
    <div className="p-6">
      <Link href={`/${locale}/items/${item.id}`}>
        <h3 className="mb-2 line-clamp-2 font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
          {item.title}
        </h3>
      </Link>
      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-foreground/60">
        {item.summary ?? t("summaryFallback")}
      </p>
      <NewsCardFooter item={item} />
    </div>
  );
}

function NewsCardFooter({ item }: { item: ItemSummary }) {
  const locale = useLocale();
  const t = useTranslations("feed");

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-foreground/55">
        <span className="truncate font-bold text-foreground/80">{item.source_name || t("sourceFallback")}</span>
        <span className="text-foreground/35">|</span>
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
  );
}

function sentimentClassName(sentiment: Sentiment): string {
  if (sentiment === "bullish") {
    return "bg-chart-1/25 text-chart-1";
  }
  if (sentiment === "bearish") {
    return "bg-chart-2/25 text-chart-2";
  }
  return "bg-white/20 text-white";
}
