"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { LastCollectionResponse, SentimentStatsResponse, TrendingKeywordsResponse } from "@/lib/types";

export function useSentimentStats(days?: number) {
  const params = days ? `?days=${days}` : "";
  const query = useQuery({
    queryKey: ["stats", "sentiment", days],
    queryFn: () => apiFetch<SentimentStatsResponse>(`/stats/sentiment${params}`),
    refetchInterval: 60_000
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}

export function useTrendingKeywords(days?: number) {
  const params = days ? `?days=${days}` : "";
  const query = useQuery({
    queryKey: ["stats", "trending-keywords", days],
    queryFn: () => apiFetch<TrendingKeywordsResponse>(`/stats/trending-keywords${params}`),
    refetchInterval: 60_000
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}

export function useLastCollectionStats() {
  const query = useQuery({
    queryKey: ["stats", "last-collection"],
    queryFn: () => apiFetch<LastCollectionResponse>("/stats/last-collection"),
    refetchInterval: 60_000
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
