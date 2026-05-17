"use client";

import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { ItemSummary, MinimalItem } from "@/lib/types";

interface ItemCardProps {
  className?: string;
  highlightKeywords?: string[];
  index?: number;
  item: ItemSummary | MinimalItem;
  metaEnd?: ReactNode;
  variant?: "default" | "compact" | "featured";
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

export function ItemCard({
  className,
  highlightKeywords = [],
  index = 0,
  item,
  metaEnd,
  variant = "default"
}: ItemCardProps) {
  const locale = useLocale();
  const t = useTranslations("feed");
  const sourceName = "source_name" in item ? item.source_name : t("sourceFallback");
  const timeLabel = relativeTime(item.published_at, locale);

  if (variant === "compact") {
    return (
      <motion.article
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "group flex min-h-12 items-center gap-3 border-b border-sigma-line bg-sigma-bg py-2 text-sm transition hover:bg-sigma-elevated/55",
          className
        )}
        initial={{ opacity: 0, y: 8 }}
        transition={{ delay: Math.min(index, 8) * 0.025, duration: 0.22 }}
      >
        <span className="shrink-0 text-xs text-sigma-muted">{timeLabel}</span>
        <span className="max-w-28 shrink-0 truncate font-medium text-sigma-text">{sourceName}</span>
        <Link
          className="min-w-0 flex-1 truncate font-medium text-sigma-text group-hover:text-sigma-accent"
          href={`/${locale}/items/${item.id}`}
        >
          {highlightTitle(item.title, highlightKeywords)}
        </Link>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <Badge category={item.category}>{t(`categories.${item.category}`)}</Badge>
          <Badge market={item.market}>{t(`markets.${item.market}`)}</Badge>
        </div>
      </motion.article>
    );
  }

  const isFeatured = variant === "featured";

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group transition hover:-translate-y-0.5",
        isFeatured
          ? "rounded-2xl border-2 border-sigma-accent/30 bg-sigma-elevated p-6"
          : "border-b border-sigma-line bg-sigma-bg py-3 hover:bg-sigma-elevated/55",
        className
      )}
      initial={{ opacity: 0, y: 12 }}
      transition={{ delay: Math.min(index, 8) * 0.035, duration: 0.28 }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-sigma-muted">
          <span className="font-medium text-sigma-text">{sourceName}</span>
          <Badge category={item.category}>{t(`categories.${item.category}`)}</Badge>
          <span>{timeLabel}</span>
          {metaEnd}
        </div>
        <Link
          className={cn(
            "flex items-start justify-between gap-4 font-semibold text-sigma-text hover:text-sigma-accent",
            isFeatured ? "mt-1 text-xl leading-8" : "text-lg leading-7"
          )}
          href={`/${locale}/items/${item.id}`}
        >
          <span>{highlightTitle(item.title, highlightKeywords)}</span>
          <ArrowUpRight
            className="mt-1 h-4 w-4 shrink-0 text-sigma-muted transition group-hover:text-sigma-accent"
            aria-hidden
          />
        </Link>
        <p className={cn("text-sm text-sigma-muted", isFeatured ? "leading-7" : "line-clamp-1 leading-6")}>
          {item.summary ?? t("summaryFallback")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge market={item.market}>{t(`markets.${item.market}`)}</Badge>
        </div>
      </div>
    </motion.article>
  );
}

function highlightTitle(title: string, keywords: string[]) {
  const normalized = keywords.map((keyword) => keyword.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return title;
  }
  const escaped = normalized.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "gi");
  return title.split(matcher).map((part, index) => {
    const matched = normalized.some((keyword) => keyword.toLowerCase() === part.toLowerCase());
    if (!matched) {
      return part;
    }
    return (
      <mark className="rounded bg-sigma-accent/20 px-0.5 text-sigma-text" key={`${part}-${index}`}>
        {part}
      </mark>
    );
  });
}
