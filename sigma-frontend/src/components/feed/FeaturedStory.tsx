"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { SentimentBadge } from "@/components/feed/SentimentBadge";
import { Badge } from "@/components/ui/Badge";
import type { ItemSummary, Sentiment } from "@/lib/types";

interface FeaturedStoryProps {
  item: ItemSummary;
}

export function FeaturedStory({ item }: FeaturedStoryProps) {
  const locale = useLocale();
  const t = useTranslations("feed");
  const sentiment = inferSentiment(item.title, item.summary);

  return (
    <article className="rounded-2xl border-2 border-sigma-accent/30 bg-sigma-elevated p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-sigma-muted">
        <span className="font-medium text-sigma-text">{item.source_name}</span>
        <Badge category={item.category}>{t(`categories.${item.category}`)}</Badge>
        <span>{relativeTime(item.published_at, locale)}</span>
        <SentimentBadge sentiment={sentiment} />
      </div>
      <Link className="mt-4 block text-xl font-semibold leading-8 text-sigma-text hover:text-sigma-accent" href={`/${locale}/items/${item.id}`}>
        {item.title}
      </Link>
      <p className="mt-3 text-sm leading-7 text-sigma-muted">{item.summary ?? t("summaryFallback")}</p>
    </article>
  );
}

export function inferSentiment(title: string, summary?: string | null): Sentiment {
  const text = `${title} ${summary ?? ""}`.toLowerCase();
  const bullish = ["bullish", "beat", "gain", "growth", "rally", "strong", "上涨", "利好", "增长"].filter((term) =>
    text.includes(term)
  ).length;
  const bearish = ["bearish", "decline", "fall", "loss", "risk", "weak", "下跌", "利空", "风险"].filter((term) =>
    text.includes(term)
  ).length;
  if (bullish > bearish) {
    return "bullish";
  }
  if (bearish > bullish) {
    return "bearish";
  }
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
