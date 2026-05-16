"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { DataSource, PaginatedResponse, SourcePayload } from "@/lib/types";
import type { User } from "@/lib/auth";

export type CollectorStatus = "success" | "fail" | "timeout";
export type HealthStatus = "green" | "yellow" | "red";

export interface AdminStats {
  users: number;
  sources: number;
  active_sources: number;
  items: number;
  tokens_today: number;
}

export interface CollectionTrendPoint {
  day: string;
  items: number;
}

export interface AdminActivity {
  id: string;
  source_id: string;
  source_name: string;
  status: CollectorStatus;
  items_count: number;
  error_message: string | null;
  duration_ms: number;
  executed_at: string;
}

export interface SourceHealth {
  source_id: string;
  name: string;
  source_type: string;
  last_success: string | null;
  rate_24h: number;
  status: HealthStatus;
}

export interface AdminUser extends User {
  updated_at: string;
}

export interface AdminLogResponse extends PaginatedResponse<AdminActivity> {
  success_rate: number;
}

export interface SourcePreviewResponse {
  items: Record<string, unknown>[];
}

export interface LLMConfig {
  provider: "anthropic" | "openai";
  model: string;
  daily_token_limit: number;
  cost_guard_enabled: boolean;
}

export interface LLMUsageDay {
  day: string;
  function_type: "summary" | "report";
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface LLMUsageResponse {
  items: LLMUsageDay[];
}

export interface AdminUserUpdate {
  role?: "admin" | "user";
  is_active?: boolean;
}

export interface AdminLogFilters {
  sourceId?: string;
  status?: CollectorStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

export function useAdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiFetch<AdminStats>("/admin/dashboard/stats"),
    refetchInterval: 30_000
  });
  const trend = useQuery({
    queryKey: ["admin", "collection-trend"],
    queryFn: () => apiFetch<CollectionTrendPoint[]>("/admin/dashboard/collection-trend"),
    refetchInterval: 30_000
  });
  const activity = useQuery({
    queryKey: ["admin", "recent-activity"],
    queryFn: () => apiFetch<AdminActivity[]>("/admin/dashboard/recent-activity"),
    refetchInterval: 30_000
  });
  const health = useQuery({
    queryKey: ["admin", "source-health"],
    queryFn: () => apiFetch<SourceHealth[]>("/admin/dashboard/source-health"),
    refetchInterval: 30_000
  });

  return { activity, health, stats, trend };
}

export function useAdminUsers(q: string) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => apiFetch<PaginatedResponse<AdminUser>>(`/admin/users?page=1&page_size=50&q=${encodeURIComponent(q)}`)
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminUserUpdate }) =>
      apiFetch<AdminUser>(`/admin/users/${id}`, {
        body: JSON.stringify(payload),
        method: "PUT"
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
  });

  return { list, remove, update };
}

export function useAdminSources() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["sources"],
    queryFn: () => apiFetch<PaginatedResponse<DataSource>>("/sources?page=1&page_size=100")
  });
  const create = useMutation({
    mutationFn: (payload: SourcePayload) =>
      apiFetch<DataSource>("/admin/sources", {
        body: JSON.stringify(payload),
        method: "POST"
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] })
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SourcePayload> }) =>
      apiFetch<DataSource>(`/admin/sources/${id}`, {
        body: JSON.stringify(payload),
        method: "PUT"
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] })
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/sources/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] })
  });
  const preview = useMutation({
    mutationFn: (payload: SourcePayload) =>
      apiFetch<SourcePreviewResponse>("/admin/sources/test", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const logs = useMutation({
    mutationFn: (id: string) => apiFetch<{ items: AdminActivity[] }>(`/admin/sources/${id}/logs`)
  });

  return { create, list, logs, preview, remove, update };
}

export function useAdminLLM() {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["admin", "llm", "config"],
    queryFn: () => apiFetch<LLMConfig>("/admin/llm/config")
  });
  const usage = useQuery({
    queryKey: ["admin", "llm", "usage"],
    queryFn: () => apiFetch<LLMUsageResponse>("/admin/llm/usage"),
    refetchInterval: 30_000
  });
  const update = useMutation({
    mutationFn: (payload: LLMConfig) =>
      apiFetch<LLMConfig>("/admin/llm/config", {
        body: JSON.stringify(payload),
        method: "PUT"
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "llm", "config"] })
  });

  return { config, update, usage };
}

export function useAdminLogs(filters: AdminLogFilters) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: "50"
  });
  if (filters.sourceId) {
    params.set("source_id", filters.sourceId);
  }
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.dateFrom) {
    params.set("date_from", `${filters.dateFrom}T00:00:00Z`);
  }
  if (filters.dateTo) {
    params.set("date_to", `${filters.dateTo}T23:59:59Z`);
  }

  return useQuery({
    queryKey: ["admin", "logs", filters],
    queryFn: () => apiFetch<AdminLogResponse>(`/admin/logs?${params.toString()}`)
  });
}
