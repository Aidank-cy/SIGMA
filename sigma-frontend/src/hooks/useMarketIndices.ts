"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { MarketIndicesResponse } from "@/lib/types";

export function useMarketIndices() {
  const query = useQuery({
    queryKey: ["market-indices"],
    queryFn: () => apiFetch<MarketIndicesResponse>("/market-indices"),
    refetchInterval: 60_000
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
