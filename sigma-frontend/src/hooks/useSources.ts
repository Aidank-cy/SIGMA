"use client";

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { DataSource, PaginatedResponse } from "@/lib/types";

interface SourcesHookResult {
  data: PaginatedResponse<DataSource> | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: UseQueryResult<PaginatedResponse<DataSource>, Error>["refetch"];
}

/** Return the current user's visible data sources. */
export function useSources(): SourcesHookResult {
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
