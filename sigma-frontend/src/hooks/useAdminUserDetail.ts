"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { DataSource, LLMConfig, LLMUsageResponse, PaginatedResponse, SourcePayload, UserReportConfig } from "@/lib/types";

export function useAdminUserLLMConfig(userId: string | null) {
  const queryClient = useQueryClient();
  const config = useQuery({
    enabled: Boolean(userId),
    placeholderData: undefined,
    queryKey: ["admin", "users", userId, "llm", "config"],
    queryFn: () => apiFetch<LLMConfig>(`/admin/users/${userId}/llm/config`),
    refetchInterval: 30_000,
    refetchOnMount: true,
    staleTime: 0
  });
  const update = useMutation({
    mutationFn: (payload: LLMConfig) =>
      apiFetch<LLMConfig>(`/admin/users/${userId}/llm/config`, {
        body: JSON.stringify(payload),
        method: "PUT"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId, "llm", "config"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    }
  });
  const usage = useQuery({
    enabled: Boolean(userId),
    placeholderData: undefined,
    queryKey: ["admin", "users", userId, "llm", "usage"],
    queryFn: () => apiFetch<LLMUsageResponse>(`/admin/users/${userId}/llm/usage`),
    refetchInterval: 30_000,
    refetchOnMount: true,
    staleTime: 0
  });

  return { config, update, usage };
}

export function useAdminUserReportConfig(userId: string | null) {
  const queryClient = useQueryClient();
  const config = useQuery({
    enabled: Boolean(userId),
    placeholderData: undefined,
    queryKey: ["admin", "users", userId, "report-config"],
    queryFn: () => apiFetch<UserReportConfig>(`/admin/users/${userId}/report-config`),
    refetchInterval: 30_000,
    refetchOnMount: true,
    staleTime: 0
  });
  const update = useMutation({
    mutationFn: (payload: UserReportConfig) =>
      apiFetch<UserReportConfig>(`/admin/users/${userId}/report-config`, {
        body: JSON.stringify({
          ...payload,
          report_frequency: payload.report_frequencies?.[0] ?? payload.report_frequency
        }),
        method: "PUT"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId, "report-config"] });
    }
  });

  return { config, update };
}

export function useAdminUserSources(userId: string | null) {
  return useQuery({
    enabled: Boolean(userId),
    placeholderData: undefined,
    queryKey: ["admin", "users", userId, "sources"],
    queryFn: () => apiFetch<PaginatedResponse<DataSource>>(`/admin/users/${userId}/sources?page=1&page_size=100`),
    refetchInterval: 30_000,
    refetchOnMount: true,
    staleTime: 0
  });
}

export function useAdminUserSourceMutations(userId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users", userId, "sources"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
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
    mutationFn: async (id: string) => {
      await apiFetch<void>(`/admin/users/${userId}/sources/${id}`, {
        method: "DELETE"
      }).catch(() => undefined);
    },
    onError: invalidate,
    onSuccess: invalidate
  });

  return { create, remove, update };
}
