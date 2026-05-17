"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { SentimentStatsResponse, TrendingKeywordsResponse } from "@/lib/types";

export function useSentimentStats() {
  const query = useQuery({
    queryKey: ["stats", "sentiment"],
    queryFn: () => apiFetch<SentimentStatsResponse>("/stats/sentiment"),
    refetchInterval: 60_000
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}

export function useTrendingKeywords() {
  const query = useQuery({
    queryKey: ["stats", "trending-keywords"],
    queryFn: () => apiFetch<TrendingKeywordsResponse>("/stats/trending-keywords"),
    refetchInterval: 60_000
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
