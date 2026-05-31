import type { LLMApiKey, LLMConfig, LLMProvider, LLMUsageResponse } from "@/lib/types";

export const apiKeyProviders: LLMProvider[] = ["anthropic", "openai", "deepseek", "qwen"];
export const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export const defaultConfig: LLMConfig = {
  daily_token_limit: 1_000_000,
  cost_guard_enabled: true,
  api_keys: []
};

export function normalizedLLMConfig(config: LLMConfig): LLMConfig {
  const apiKeys = (config.api_keys ?? []).map((entry) => ({ ...entry, is_default: Boolean(entry.is_default), provider: entry.provider || "anthropic", token_limit: entry.token_limit || 1_000_000 }));
  if (apiKeys.length === 0) {
    apiKeys.push({ is_default: true, key: "", name: "", provider: "anthropic", token_limit: 1_000_000 });
  }
  return { ...config, api_keys: apiKeys };
}

export function llmConfigsEqual(left: LLMConfig, right: LLMConfig) {
  return left.daily_token_limit === right.daily_token_limit && left.cost_guard_enabled === right.cost_guard_enabled && llmApiKeysEqual(left.api_keys, right.api_keys);
}

function llmApiKeysEqual(left: LLMApiKey[], right: LLMApiKey[]) {
  return left.length === right.length && left.every((entry, index) => {
    const other = right[index];
    return other !== undefined && entry.name === other.name && entry.key === other.key && entry.provider === other.provider && entry.token_limit === other.token_limit && entry.is_default === other.is_default;
  });
}

export function normalizedLLMConfigForSave(config: LLMConfig): LLMConfig {
  const apiKeys = (config.api_keys ?? []).filter((entry) => !apiKeyIsBlank(entry)).map((entry) => ({ ...entry, is_default: Boolean(entry.is_default), provider: entry.provider || "anthropic", token_limit: entry.token_limit || 1_000_000 }));
  const hasDefault = apiKeys.some((entry) => entry.is_default);
  return { ...config, api_keys: apiKeys.map((entry, index) => ({ ...entry, is_default: entry.is_default || (!hasDefault && index === 0) })) };
}

function apiKeyIsBlank(entry: LLMApiKey) {
  return entry.name.trim().length === 0 && entry.key.trim().length === 0;
}

export function apiKeyIsInvalid(entry: LLMApiKey) {
  return !apiKeyIsBlank(entry) && (entry.name.trim().length === 0 || entry.key.trim().length === 0 || entry.provider.trim().length === 0);
}

export function parseTokenAmount(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(/,/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

export function usageTotals(usageData?: LLMUsageResponse) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const monthAgo = new Date(startOfToday);
  monthAgo.setDate(monthAgo.getDate() - 29);
  return (usageData?.items ?? []).reduce((acc, item) => {
    const day = new Date(item.day);
    if (day >= startOfToday) acc.today += item.total_tokens;
    if (day >= weekAgo) acc.week += item.total_tokens;
    if (day >= monthAgo) acc.month += item.total_tokens;
    return acc;
  }, { month: 0, today: 0, week: 0 });
}

export function trendRows(usageData: LLMUsageResponse | undefined, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric" });
  const days = Array.from({ length: 14 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (13 - index));
    const key = day.toISOString().slice(0, 10);
    return { day: formatter.format(day), input: 0, key, output: 0 };
  });
  for (const item of usageData?.items ?? []) {
    const row = days.find((entry) => entry.key === item.day.slice(0, 10));
    if (row) {
      row.input += item.input_tokens;
      row.output += item.output_tokens;
    }
  }
  return days.map(({ day, input, output }) => ({ day, input, output }));
}

export function dailyUsageRows(usageData?: LLMUsageResponse) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    return { day: key.slice(5), key, tokens: 0 };
  });
  for (const item of usageData?.items ?? []) {
    const row = days.find((entry) => entry.key === item.day.slice(0, 10));
    if (row) row.tokens += item.total_tokens;
  }
  return days.map(({ day, tokens }) => ({ day, tokens }));
}

export function formatCooldownCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}
