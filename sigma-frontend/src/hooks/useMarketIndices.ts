"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { MarketIndex, MarketIndicesResponse } from "@/lib/types";

export function useMarketIndices() {
  const query = useQuery({
    queryKey: ["market-indices"],
    queryFn: async () => {
      const response = await apiFetch<MarketIndex[] | MarketIndicesResponse>("/market-indices");
      return Array.isArray(response) ? { indices: response } : response;
    },
    refetchInterval: 60_000
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
