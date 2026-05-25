"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { LLMConfig, LLMUsageResponse } from "@/lib/types";

export function useLLMSettings() {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["llm", "config"],
    queryFn: () => apiFetch<LLMConfig>("/me/llm/config"),
    refetchInterval: 3_000,
    staleTime: 0,
    gcTime: 0
  });
  const usage = useQuery({
    queryKey: ["llm", "usage"],
    queryFn: () => apiFetch<LLMUsageResponse>("/me/llm/usage"),
    refetchInterval: 3_000,
    staleTime: 0,
    gcTime: 0
  });
  const update = useMutation({
    mutationFn: (payload: LLMConfig) =>
      apiFetch<LLMConfig>("/me/llm/config", {
        body: JSON.stringify(payload),
        method: "PUT"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm", "config"] });
      queryClient.invalidateQueries({ queryKey: ["llm", "usage"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "llm", "config"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    }
  });

  return { config, update, usage };
}
