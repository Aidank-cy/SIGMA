"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  FetchNextPageOptions,
  InfiniteData,
  InfiniteQueryObserverResult,
  QueryObserverResult,
  RefetchOptions,
  UseQueryResult
} from "@tanstack/react-query";

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
  if (filters.source_id) {
    params.set("source_id", filters.source_id);
  }
  return params.toString();
}

type ItemPages = InfiniteData<PaginatedResponse<ItemSummary>, number>;

interface InfiniteItemsHookResult {
  data: ItemPages | undefined;
  error: Error | null;
  fetchNextPage: (
    options?: FetchNextPageOptions
  ) => Promise<InfiniteQueryObserverResult<ItemPages, Error>>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  mutate: (options?: RefetchOptions) => Promise<QueryObserverResult<ItemPages, Error>>;
}

interface ItemsPaginatedHookResult {
  data: PaginatedResponse<ItemSummary> | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: UseQueryResult<PaginatedResponse<ItemSummary>, Error>["refetch"];
}

interface ItemHookResult {
  data: ItemDetail | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: UseQueryResult<ItemDetail, Error>["refetch"];
}

/** Return an infinite list of collected items for the given filters. */
export function useItems(filters: ItemFilters = {}): InfiniteItemsHookResult {
  const query = useInfiniteQuery<
    PaginatedResponse<ItemSummary>,
    Error,
    ItemPages,
    readonly ["items", ItemFilters],
    number
  >({
    initialPageParam: 1,
    queryKey: ["items", filters],
    queryFn: ({ pageParam }) =>
      apiFetch<PaginatedResponse<ItemSummary>>(`/items?${buildItemQuery(filters, pageParam)}`),
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    placeholderData: undefined
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

/** Return one paginated page of collected items for the given filters. */
export function useItemsPaginated(
  filters: ItemFilters = {},
  page: number
): ItemsPaginatedHookResult {
  const query = useQuery({
    queryKey: ["items", "paginated", filters, page],
    queryFn: () => apiFetch<PaginatedResponse<ItemSummary>>(`/items?${buildItemQuery(filters, page)}`),
    placeholderData: undefined
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading || query.isFetching,
    mutate: query.refetch
  };
}

/** Return one collected item detail record. */
export function useItem(id: string): ItemHookResult {
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
