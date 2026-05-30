"use client";

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { marketIndicesRefetchInterval } from "@/lib/marketSessions";
import type { MarketIndex, MarketIndicesResponse } from "@/lib/types";

export const marketIndicesQueryKey = ["market-indices"] as const;

function normalizeMarketIndices(response: MarketIndex[] | MarketIndicesResponse): MarketIndicesResponse {
  if (Array.isArray(response)) {
    return { indices: response, updated_at: "" };
  }
  return {
    indices: Array.isArray(response.indices) ? response.indices : [],
    updated_at: response.updated_at ?? ""
  };
}

export async function fetchMarketIndices(): Promise<MarketIndicesResponse> {
  const response = await apiFetch<MarketIndex[] | MarketIndicesResponse>("/market-indices");
  return normalizeMarketIndices(response);
}

interface MarketIndicesHookResult {
  data: MarketIndicesResponse | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: UseQueryResult<MarketIndicesResponse, Error>["refetch"];
}

/** Return live market indices with market-aware polling. */
export function useMarketIndices(): MarketIndicesHookResult {
  const query = useQuery({
    queryKey: marketIndicesQueryKey,
    queryFn: fetchMarketIndices,
    refetchInterval: (query) => marketIndicesRefetchInterval(query.state.data?.indices ?? [])
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
