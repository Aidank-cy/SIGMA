"use client";

import { ItemCard } from "@/components/feed/ItemCard";
import { SentimentBadge } from "@/components/feed/SentimentBadge";
import type { ItemSummary, Sentiment } from "@/lib/types";

interface FeaturedStoryProps {
  item: ItemSummary;
}

export function FeaturedStory({ item }: FeaturedStoryProps) {
  const sentiment = inferSentiment(item.title, item.summary);

  return <ItemCard item={item} metaEnd={<SentimentBadge sentiment={sentiment} />} variant="featured" />;
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
