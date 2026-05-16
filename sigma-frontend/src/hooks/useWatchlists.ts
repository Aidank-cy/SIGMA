"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { ItemSummary, PaginatedResponse, Watchlist, WatchlistPayload } from "@/lib/types";

interface WatchlistListResponse {
  items: Watchlist[];
}

export function useWatchlists() {
  const query = useQuery({
    queryKey: ["watchlists"],
    queryFn: () => apiFetch<WatchlistListResponse>("/watchlists")
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}

export function useWatchlistItems(watchlistId: string | null) {
  const query = useInfiniteQuery({
    enabled: watchlistId !== null,
    initialPageParam: 1,
    queryKey: ["watchlist-items", watchlistId],
    queryFn: ({ pageParam }) =>
      apiFetch<PaginatedResponse<ItemSummary>>(
        `/watchlists/${watchlistId}/items?page=${pageParam}&page_size=20`
      ),
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

export function useWatchlistMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["watchlists"] });

  return {
    createWatchlist: useMutation({
      mutationFn: (payload: WatchlistPayload) =>
        apiFetch<Watchlist>("/watchlists", { body: JSON.stringify(payload), method: "POST" }),
      onSuccess: invalidate
    }),
    deleteWatchlist: useMutation({
      mutationFn: (id: string) => apiFetch<void>(`/watchlists/${id}`, { method: "DELETE" }),
      onSuccess: invalidate
    }),
    updateWatchlist: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: WatchlistPayload }) =>
        apiFetch<Watchlist>(`/watchlists/${id}`, { body: JSON.stringify(payload), method: "PUT" }),
      onSuccess: (_data, variables) => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["watchlist-items", variables.id] });
      }
    })
  };
}
