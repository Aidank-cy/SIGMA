"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import type { Sentiment } from "@/lib/types";

interface SentimentBadgeProps {
  sentiment: Sentiment;
}

export function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const t = useTranslations("feed.sentiment");

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-xs font-bold",
        sentiment === "bullish" && "bg-chart-1/12 text-chart-1",
        sentiment === "bearish" && "bg-destructive/12 text-destructive",
        sentiment === "neutral" && "bg-muted text-muted-foreground"
      )}
    >
      {t(sentiment)}
    </span>
  );
}
