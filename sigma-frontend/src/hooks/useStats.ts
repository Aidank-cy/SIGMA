"use client";

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  LastCollectionResponse,
  SentimentStatsResponse,
  TrendingKeywordsResponse
} from "@/lib/types";

interface StatsHookResult<TData> {
  data: TData | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: UseQueryResult<TData, Error>["refetch"];
}

/** Return sentiment percentage statistics for the requested lookback window. */
export function useSentimentStats(days?: number): StatsHookResult<SentimentStatsResponse> {
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

/** Return trending keyword counts for the requested lookback window. */
export function useTrendingKeywords(days?: number): StatsHookResult<TrendingKeywordsResponse> {
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

/** Return the most recent successful collection timestamp. */
export function useLastCollectionStats(): StatsHookResult<LastCollectionResponse> {
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
