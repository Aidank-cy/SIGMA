"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { LLMConfig, LLMUsageResponse } from "@/lib/types";

function llmConfigUpdateBody(payload: LLMConfig) {
  return {
    api_keys: payload.api_keys,
    cost_guard_enabled: payload.cost_guard_enabled,
    daily_token_limit: payload.daily_token_limit
  };
}

export function useLLMSettings() {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["llm", "config"],
    queryFn: () => apiFetch<LLMConfig>("/me/llm/config"),
    staleTime: 5_000,
    notifyOnChangeProps: ["data", "error", "isLoading"]
  });
  const usage = useQuery({
    queryKey: ["llm", "usage"],
    queryFn: () => apiFetch<LLMUsageResponse>("/me/llm/usage"),
    staleTime: 5_000,
    notifyOnChangeProps: ["data", "error", "isLoading"]
  });
  const update = useMutation({
    mutationFn: (payload: LLMConfig) =>
      apiFetch<LLMConfig>("/me/llm/config", {
        body: JSON.stringify(llmConfigUpdateBody(payload)),
        method: "PUT"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm", "config"] });
      queryClient.invalidateQueries({ queryKey: ["llm", "usage"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    }
  });

  return { config, update, usage };
}
