"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { marketIndicesRefetchInterval } from "@/lib/marketSessions";
import type { MarketIndex, MarketIndicesResponse } from "@/lib/types";

function normalizeMarketIndices(response: MarketIndex[] | MarketIndicesResponse): MarketIndicesResponse {
  if (Array.isArray(response)) {
    return { indices: response, updated_at: "" };
  }
  return {
    indices: Array.isArray(response.indices) ? response.indices : [],
    updated_at: response.updated_at ?? ""
  };
}

export function useMarketIndices() {
  const query = useQuery({
    queryKey: ["market-indices"],
    queryFn: async () => {
      const response = await apiFetch<MarketIndex[] | MarketIndicesResponse>("/market-indices");
      return normalizeMarketIndices(response);
    },
    refetchInterval: (query) => marketIndicesRefetchInterval(query.state.data?.indices ?? [])
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
