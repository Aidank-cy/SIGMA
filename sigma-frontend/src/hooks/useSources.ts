"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { DataSource, PaginatedResponse } from "@/lib/types";

export function useSources() {
  const query = useQuery({
    queryKey: ["sources"],
    queryFn: () => apiFetch<PaginatedResponse<DataSource>>("/sources?page=1&page_size=100")
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
