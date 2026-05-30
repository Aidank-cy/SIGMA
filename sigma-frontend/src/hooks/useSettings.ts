"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { Locale, UserReportConfig } from "@/lib/types";
import type { User } from "@/lib/auth";

interface ReportConfigHookResult {
  data: UserReportConfig | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: UseQueryResult<UserReportConfig, Error>["refetch"];
}

interface PasswordResetRequestPayload {
  email: string;
}

interface PasswordResetVerifyPayload {
  code: string;
  email: string;
}

interface PasswordResetConfirmPayload {
  new_password: string;
  reset_token: string;
}

interface ProfileUpdatePayload {
  display_name: string;
  locale: Locale;
}

interface RetentionUpdatePayload {
  data_retention_days: number;
}

interface MessageResponse {
  message: string;
}

interface PasswordResetRequestResponse extends MessageResponse {
  dev_code?: string;
}

interface PasswordResetVerifyResponse {
  expires_in: number;
  reset_token: string;
  token_type: string;
}

interface SettingsMutationsHookResult {
  requestPasswordReset: UseMutationResult<
    PasswordResetRequestResponse,
    Error,
    PasswordResetRequestPayload
  >;
  resetPassword: UseMutationResult<MessageResponse, Error, PasswordResetConfirmPayload>;
  updateProfile: UseMutationResult<User, Error, ProfileUpdatePayload>;
  updateReportConfig: UseMutationResult<UserReportConfig, Error, UserReportConfig>;
  updateRetention: UseMutationResult<User, Error, RetentionUpdatePayload>;
  verifyResetCode: UseMutationResult<
    PasswordResetVerifyResponse,
    Error,
    PasswordResetVerifyPayload
  >;
}

/** Return the current user's report configuration. */
export function useReportConfig(): ReportConfigHookResult {
  const query = useQuery({
    queryKey: ["report-config"],
    queryFn: () => apiFetch<UserReportConfig>("/me/report-config"),
    retry: 1,
    staleTime: 5_000,
    notifyOnChangeProps: ["data", "error", "isLoading"]
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    mutate: query.refetch
  };
}

/** Return user settings mutation handles. */
export function useSettingsMutations(): SettingsMutationsHookResult {
  const queryClient = useQueryClient();

  return {
    requestPasswordReset: useMutation({
      mutationFn: (payload: { email: string }) =>
        apiFetch<{ dev_code?: string; message: string }>("/auth/request-password-reset", {
          body: JSON.stringify(payload),
          method: "POST"
        })
    }),
    resetPassword: useMutation({
      mutationFn: (payload: { new_password: string; reset_token: string }) =>
        apiFetch<{ message: string }>("/auth/reset-password", {
          body: JSON.stringify(payload),
          method: "POST"
        })
    }),
    updateProfile: useMutation({
      mutationFn: (payload: { display_name: string; locale: Locale }) =>
        apiFetch<User>("/me/profile", { body: JSON.stringify(payload), method: "PUT" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-user"] })
    }),
    updateReportConfig: useMutation({
      mutationFn: (payload: UserReportConfig) =>
        apiFetch<UserReportConfig>("/me/report-config", {
          body: JSON.stringify({
            ...payload,
            report_frequency: payload.report_frequencies?.[0] ?? payload.report_frequency
          }),
          method: "PUT"
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["report-config"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      }
    }),
    updateRetention: useMutation({
      mutationFn: (payload: { data_retention_days: number }) =>
        apiFetch<User>("/me/retention", { body: JSON.stringify(payload), method: "PUT" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-user"] })
    }),
    verifyResetCode: useMutation({
      mutationFn: (payload: { code: string; email: string }) =>
        apiFetch<{ expires_in: number; reset_token: string; token_type: string }>("/auth/verify-reset-code", {
          body: JSON.stringify(payload),
          method: "POST"
        })
    })
  };
}
