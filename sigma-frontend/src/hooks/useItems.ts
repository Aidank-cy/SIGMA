"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { ItemDetail, ItemFilters, ItemSummary, PaginatedResponse } from "@/lib/types";

function buildItemQuery(filters: ItemFilters, page: number): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(filters.page_size ?? 20)
  });
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.date_from) {
    params.set("date_from", filters.date_from);
  }
  if (filters.date_to) {
    params.set("date_to", filters.date_to);
  }
  if (filters.market) {
    params.set("market", filters.market);
  }
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }
  return params.toString();
}

export function useItems(filters: ItemFilters = {}) {
  const query = useInfiniteQuery({
    initialPageParam: 1,
    queryKey: ["items", filters],
    queryFn: ({ pageParam }) =>
      apiFetch<PaginatedResponse<ItemSummary>>(`/items?${buildItemQuery(filters, pageParam)}`),
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined)
  });

  return {
    data: query.data,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}

export function useItem(id: string) {
  const query = useQuery({
    enabled: id.length > 0,
    queryKey: ["item", id],
    queryFn: () => apiFetch<ItemDetail>(`/items/${id}`)
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
