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
        "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold",
        sentiment === "bullish" && "bg-sigma-success/12 text-sigma-success",
        sentiment === "bearish" && "bg-sigma-danger/12 text-sigma-danger",
        sentiment === "neutral" && "bg-sigma-neutral/14 text-sigma-muted"
      )}
    >
      {t(sentiment)}
    </span>
  );
}
