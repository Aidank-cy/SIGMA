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
import type { PaginatedResponse, ReportDetail, ReportSummary, ReportType } from "@/lib/types";

type ReportPages = InfiniteData<PaginatedResponse<ReportSummary>, number>;

interface ReportsHookResult {
  data: ReportPages | undefined;
  error: Error | null;
  fetchNextPage: (
    options?: FetchNextPageOptions
  ) => Promise<InfiniteQueryObserverResult<ReportPages, Error>>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  mutate: (options?: RefetchOptions) => Promise<QueryObserverResult<ReportPages, Error>>;
}

interface ReportHookResult {
  data: ReportDetail | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: UseQueryResult<ReportDetail, Error>["refetch"];
}

/** Return an infinite list of generated reports. */
export function useReports(reportType?: ReportType, pageSize = 12): ReportsHookResult {
  const query = useInfiniteQuery<
    PaginatedResponse<ReportSummary>,
    Error,
    ReportPages,
    readonly ["reports", ReportType | "all", number],
    number
  >({
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

/** Return one generated report detail record. */
export function useReport(id: string): ReportHookResult {
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
