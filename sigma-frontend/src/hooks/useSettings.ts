"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { Locale, UserReportConfig } from "@/lib/types";
import type { User } from "@/lib/auth";

export function useReportConfig() {
  const query = useQuery({
    queryKey: ["report-config"],
    queryFn: () => apiFetch<UserReportConfig>("/me/report-config")
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}

export function useSettingsMutations() {
  const queryClient = useQueryClient();

  return {
    updatePassword: useMutation({
      mutationFn: (payload: { current_password: string; new_password: string }) =>
        apiFetch<void>("/me/password", { body: JSON.stringify(payload), method: "PUT" })
    }),
    updateProfile: useMutation({
      mutationFn: (payload: { display_name: string; locale: Locale }) =>
        apiFetch<User>("/me/profile", { body: JSON.stringify(payload), method: "PUT" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-user"] })
    }),
    updateReportConfig: useMutation({
      mutationFn: (payload: UserReportConfig) =>
        apiFetch<UserReportConfig>("/me/report-config", {
          body: JSON.stringify(payload),
          method: "PUT"
        }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-config"] })
    }),
    updateRetention: useMutation({
      mutationFn: (payload: { data_retention_days: number }) =>
        apiFetch<User>("/me/retention", { body: JSON.stringify(payload), method: "PUT" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-user"] })
    })
  };
}
