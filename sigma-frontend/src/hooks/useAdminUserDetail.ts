"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  DataSource,
  LLMConfig,
  LLMUsageResponse,
  PaginatedResponse,
  ReportTimeRange,
  ReportType,
  SourcePayload,
  UserReportConfig
} from "@/lib/types";

function reportConfigUpdateBody(payload: UserReportConfig) {
  const maxTokens = sanitizeReportMaxTokens(payload.max_tokens);
  const timeRanges = sanitizeReportTimeRanges(payload.time_ranges);
  return {
    categories: payload.categories,
    is_active: payload.is_active,
    markets: payload.markets,
    max_tokens: maxTokens,
    report_frequencies: payload.report_frequencies ?? [payload.report_frequency],
    report_frequency: payload.report_frequencies?.[0] ?? payload.report_frequency,
    time_ranges: timeRanges
  };
}

function llmConfigUpdateBody(payload: LLMConfig) {
  return {
    api_keys: payload.api_keys,
    cost_guard_enabled: payload.cost_guard_enabled,
    daily_token_limit: payload.daily_token_limit
  };
}

function sanitizeReportMaxTokens(maxTokens?: Partial<Record<ReportType, number>>) {
  if (!maxTokens) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(maxTokens).filter((entry): entry is [ReportType, number] => {
      const value = entry[1];
      return Number.isInteger(value) && value > 0;
    })
  );
}

function sanitizeReportTimeRanges(timeRanges?: Partial<Record<ReportType, ReportTimeRange>>) {
  if (!timeRanges) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(timeRanges)
      .map(([reportType, range]) => [reportType, stripEmptyTimeRange(range)] as const)
      .filter((entry): entry is [ReportType, ReportTimeRange] => entry[1] !== null)
  );
}

function stripEmptyTimeRange(range?: ReportTimeRange): ReportTimeRange | null {
  if (!range) {
    return null;
  }
  const cleaned = Object.fromEntries(
    Object.entries(range).filter(([, value]) => value !== null && value !== undefined)
  ) as ReportTimeRange;
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

export function useAdminUserLLMConfig(userId: string | null) {
  const queryClient = useQueryClient();
  const config = useQuery({
    enabled: Boolean(userId),
    queryKey: ["admin", "users", userId, "llm", "config"],
    queryFn: () => apiFetch<LLMConfig>(`/admin/users/${userId}/llm/config`),
    refetchOnMount: true,
    staleTime: 0
  });
  const update = useMutation({
    mutationFn: (payload: LLMConfig) =>
      apiFetch<LLMConfig>(`/admin/users/${userId}/llm/config`, {
        body: JSON.stringify(llmConfigUpdateBody(payload)),
        method: "PUT"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId, "llm", "config"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["llm", "config"] });
      queryClient.invalidateQueries({ queryKey: ["llm", "usage"] });
    }
  });
  const usage = useQuery({
    enabled: Boolean(userId),
    queryKey: ["admin", "users", userId, "llm", "usage"],
    queryFn: () => apiFetch<LLMUsageResponse>(`/admin/users/${userId}/llm/usage`),
    refetchOnMount: true,
    staleTime: 0
  });

  return { config, update, usage };
}

export function useAdminUserReportConfig(userId: string | null) {
  const queryClient = useQueryClient();
  const config = useQuery({
    enabled: Boolean(userId),
    queryKey: ["admin", "users", userId, "report-config"],
    queryFn: () => apiFetch<UserReportConfig>(`/admin/users/${userId}/report-config`),
    placeholderData: undefined,
    refetchOnMount: true,
    retry: 1,
    staleTime: 0
  });
  const update = useMutation({
    mutationFn: (payload: UserReportConfig) =>
      apiFetch<UserReportConfig>(`/admin/users/${userId}/report-config`, {
        body: JSON.stringify(reportConfigUpdateBody(payload)),
        method: "PUT"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId, "report-config"] });
      queryClient.invalidateQueries({ queryKey: ["report-config"] });
    }
  });

  return { config, update };
}

export function useAdminUserSources(userId: string | null) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: ["admin", "users", userId, "sources"],
    queryFn: () => apiFetch<PaginatedResponse<DataSource>>(`/admin/users/${userId}/sources?page=1&page_size=100`),
    refetchOnMount: true,
    staleTime: 0
  });
}

export function useAdminUserSourceMutations(userId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users", userId, "sources"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["sources"] });
  };

  const create = useMutation({
    mutationFn: (payload: SourcePayload) =>
      apiFetch<DataSource>(`/admin/users/${userId}/sources`, {
        body: JSON.stringify(payload),
        method: "POST"
      }),
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SourcePayload> }) =>
      apiFetch<DataSource>(`/admin/users/${userId}/sources/${id}`, {
        body: JSON.stringify(payload),
        method: "PUT"
      }),
    onSuccess: invalidate
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/users/${userId}/sources/${id}`, {
        method: "DELETE"
      }),
    onError: invalidate,
    onSuccess: invalidate
  });

  return { create, remove, update };
}
