"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, ReportDetail, ReportSummary, ReportType } from "@/lib/types";

export function useReports(reportType?: ReportType, pageSize = 12) {
  const query = useInfiniteQuery({
    initialPageParam: 1,
    queryKey: ["reports", reportType ?? "all", pageSize],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), page_size: String(pageSize) });
      if (reportType) {
        params.set("report_type", reportType);
      }
      return apiFetch<PaginatedResponse<ReportSummary>>(`/reports?${params.toString()}`);
    },
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

export function useReport(id: string) {
  const query = useQuery({
    enabled: id.length > 0,
    queryKey: ["report", id],
    queryFn: () => apiFetch<ReportDetail>(`/reports/${id}`)
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}
