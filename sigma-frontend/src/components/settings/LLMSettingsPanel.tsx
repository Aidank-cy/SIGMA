"use client";

import { DollarSign, Plus, ShieldCheck, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useToast } from "@/components/ui/Toast";
import type { LLMApiKey, LLMConfig, LLMUsageResponse } from "@/lib/types";

const models: Record<string, string[]> = {
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-latest", "claude-opus-4-20250514"],
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  minimax: ["minimax-01", "abab7-chat"],
  kimi: ["moonshot-v1-128k", "moonshot-v1-32k"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash"]
};

const providers: LLMConfig["provider"][] = ["anthropic", "openai", "deepseek", "minimax", "kimi", "gemini"];

const tokenCost = 0.000003;

const TokenTrendChart = dynamic(
  () => import("@/components/charts/LLMUsageCharts").then((module) => module.TokenTrendChart),
  {
    loading: () => <Skeleton className="h-72 w-full" />,
    ssr: false
  }
);
const FunctionUsageChart = dynamic(
  () => import("@/components/charts/LLMUsageCharts").then((module) => module.FunctionUsageChart),
  {
    loading: () => <Skeleton className="h-72 w-full" />,
    ssr: false
  }
);
const ProviderUsageDistributionChart = dynamic(
  () => import("@/components/charts/LLMUsageCharts").then((module) => module.ProviderUsageDistributionChart),
  {
    loading: () => <Skeleton className="h-72 w-full" />,
    ssr: false
  }
);
const DailyUsageSparkline = dynamic(
  () => import("@/components/charts/LLMUsageCharts").then((module) => module.DailyUsageSparkline),
  {
    loading: () => <Skeleton className="h-16 w-full" />,
    ssr: false
  }
);

const defaultConfig: LLMConfig = {
  provider: "anthropic",
  model: models.anthropic[0],
  daily_token_limit: 1_000_000,
  cost_guard_enabled: true,
  api_keys: []
};

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

interface LLMSettingsPanelProps {
  configData?: LLMConfig;
  isConfigLoading?: boolean;
  isSaving: boolean;
  onSave: (form: LLMConfig) => Promise<unknown>;
  showCharts?: boolean;
  usageData?: LLMUsageResponse;
}

export function LLMSettingsPanel({
  configData,
  isConfigLoading = false,
  isSaving,
  onSave,
  showCharts = false,
  usageData
}: LLMSettingsPanelProps) {
  const t = useTranslations("admin.llm");
  const toast = useToast();
  const [form, setForm] = useState<LLMConfig>(defaultConfig);

  useEffect(() => {
    if (configData) {
      setForm({
        ...configData,
        api_keys: configData.api_keys.map((entry) => ({
          ...entry,
          provider: entry.provider || configData.provider,
          token_limit: entry.token_limit || 1_000_000
        }))
      });
    }
  }, [configData]);

  const totals = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(startOfToday);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const monthAgo = new Date(startOfToday);
    monthAgo.setDate(monthAgo.getDate() - 29);
    return (usageData?.items ?? []).reduce(
      (acc, item) => {
        const day = new Date(item.day);
        if (day >= startOfToday) {
          acc.today += item.total_tokens;
        }
        if (day >= weekAgo) {
          acc.week += item.total_tokens;
        }
        if (day >= monthAgo) {
          acc.month += item.total_tokens;
        }
        return acc;
      },
      { month: 0, today: 0, week: 0 }
    );
  }, [usageData]);

  const trendData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (13 - index));
      const key = day.toISOString().slice(0, 10);
      return { day: key.slice(5), input: 0, output: 0 };
    });
    for (const item of usageData?.items ?? []) {
      const key = item.day.slice(5);
      const row = days.find((entry) => entry.day === key);
      if (row) {
        row.input += item.input_tokens;
        row.output += item.output_tokens;
      }
    }
    return days;
  }, [usageData]);

  const functionData = useMemo(() => {
    const rows = { report: 0, summary: 0 };
    for (const item of usageData?.items ?? []) {
      rows[item.function_type] += item.total_tokens;
    }
    return [
      { name: t("functions.summary"), tokens: rows.summary },
      { name: t("functions.report"), tokens: rows.report }
    ];
  }, [t, usageData]);

  const providerDistributionData = useMemo(() => {
    const usageByProvider = new Map<string, number>();
    for (const item of usageData?.items ?? []) {
      if (item.provider && item.total_tokens > 0) {
        usageByProvider.set(item.provider, (usageByProvider.get(item.provider) ?? 0) + item.total_tokens);
      }
    }

    if (usageByProvider.size === 0) {
      return [
        { color: chartColors[0], name: `${t("providers.anthropic")} 55%`, tokens: 55 },
        { color: chartColors[1], name: `${t("providers.openai")} 25%`, tokens: 25 },
        { color: chartColors[2], name: `${t("providers.deepseek")} 12%`, tokens: 12 },
        { color: chartColors[3], name: `${t("providers.gemini")} 8%`, tokens: 8 }
      ];
    }

    const totalTokens = Array.from(usageByProvider.values()).reduce((total, tokens) => total + tokens, 0);
    return Array.from(usageByProvider.entries()).map(([provider, tokens], index) => {
      const providerName = providers.includes(provider as LLMConfig["provider"])
        ? t(`providers.${provider as LLMConfig["provider"]}`)
        : provider;
      const percentage = totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0;
      return {
        color: chartColors[index % chartColors.length],
        name: `${providerName} ${percentage}%`,
        tokens
      };
    });
  }, [t, usageData]);

  const dailyUsageData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return { day: key.slice(5), key, tokens: 0 };
    });
    for (const item of usageData?.items ?? []) {
      const row = days.find((entry) => entry.key === item.day.slice(0, 10));
      if (row) {
        row.tokens += item.total_tokens;
      }
    }
    return days.map(({ day, tokens }) => ({ day, tokens }));
  }, [usageData]);

  const dailyBudgetPercent =
    form.daily_token_limit > 0 ? Math.min(100, Math.round((totals.today / form.daily_token_limit) * 100)) : 0;

  const hasInvalidApiKeys = form.api_keys.some(
    (entry) =>
      entry.name.trim().length === 0 ||
      entry.key.trim().length === 0 ||
      entry.provider.trim().length === 0 ||
      entry.token_limit <= 0
  );

  const groupedApiKeys = useMemo(
    () =>
      providers
        .map((provider) => ({
          entries: form.api_keys
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.provider === provider),
          provider
        }))
        .filter((group) => group.entries.length > 0),
    [form.api_keys]
  );

  const providerOptions = providers.map((provider) => ({
    label: t(`providers.${provider}`),
    value: provider
  }));

  function addApiKey() {
    setForm({
      ...form,
      api_keys: [
        ...form.api_keys,
        { key: "", name: t("newKeyName"), provider: form.provider, token_limit: 1_000_000 }
      ]
    });
  }

  function updateApiKey(index: number, field: keyof LLMApiKey, value: string | number) {
    setForm({
      ...form,
      api_keys: form.api_keys.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      )
    });
  }

  function removeApiKey(index: number) {
    setForm({
      ...form,
      api_keys: form.api_keys.filter((_, entryIndex) => entryIndex !== index)
    });
  }

  async function save() {
    try {
      await onSave(form);
      toast.showToast(t("saved"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  }

  if (isConfigLoading) {
    return <Skeleton className="h-80 rounded-2xl" />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <CustomSelect
              labelMode="stacked"
              label={t("provider")}
              onChange={(value) =>
                setForm({
                  ...form,
                  provider: value as LLMConfig["provider"],
                  model: models[value][0]
                })
              }
              options={providerOptions}
              value={form.provider}
            />
            <CustomSelect
              labelMode="stacked"
              label={t("model")}
              onChange={(value) => setForm({ ...form, model: value })}
              options={models[form.provider].map((model) => ({ label: model, value: model }))}
              value={form.model}
            />
          </div>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-sigma-line p-3 text-sm font-medium text-sigma-text">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sigma-muted" aria-hidden />
              {t("costGuard")}
            </span>
            <ToggleSwitch
              checked={form.cost_guard_enabled}
              label={t("costGuard")}
              onChange={(checked) => setForm({ ...form, cost_guard_enabled: checked })}
            />
          </label>
          {showCharts ? (
            <section className="grid gap-4 xl:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-lg font-semibold text-foreground">{t("providerUsageDistribution")}</h3>
                <ProviderUsageDistributionChart data={providerDistributionData} />
              </Card>
              <Card className="space-y-4 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t("dailyTokenBudget")}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("dailyTokenBudgetCaption", {
                      limit: form.daily_token_limit.toLocaleString(),
                      tokens: totals.today.toLocaleString()
                    })}
                  </p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{dailyBudgetPercent}%</span>
                    <span className="text-muted-foreground">
                      {totals.today.toLocaleString()} / {form.daily_token_limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${dailyBudgetPercent}%` }} />
                  </div>
                </div>
                <DailyUsageSparkline data={dailyUsageData} />
              </Card>
            </section>
          ) : (
            <section className="space-y-3 rounded-lg border border-sigma-line p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-sigma-text">{t("apiKeys")}</h3>
                  <p className="mt-1 text-xs leading-5 text-sigma-muted">{t("apiKeysCaption")}</p>
                </div>
                <Button onClick={addApiKey} size="sm" type="button" variant="secondary">
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("addKey")}
                </Button>
              </div>
              {form.api_keys.length === 0 ? (
                <p className="rounded-lg bg-sigma-elevated px-3 py-2 text-sm text-sigma-muted">{t("emptyKeys")}</p>
              ) : (
                <div className="space-y-4">
                  {groupedApiKeys.map((group) => (
                    <div className="space-y-2" key={group.provider}>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-sigma-muted">
                        {t(`providers.${group.provider}`)}
                      </h4>
                      <div className="space-y-3">
                        {group.entries.map(({ entry, index }) => (
                          <div
                            className="grid gap-3 rounded-lg bg-sigma-elevated p-3 lg:grid-cols-[0.9fr_1fr_1fr_0.8fr_auto]"
                            key={index}
                          >
                            <CustomSelect
                              labelMode="stacked"
                              label={t("provider")}
                              onChange={(value) => updateApiKey(index, "provider", value)}
                              options={providerOptions}
                              value={entry.provider}
                            />
                            <Input
                              label={t("keyName")}
                              labelMode="stacked"
                              onChange={(event) => updateApiKey(index, "name", event.target.value)}
                              value={entry.name}
                            />
                            <Input
                              label={t("keyValue")}
                              labelMode="stacked"
                              onChange={(event) => updateApiKey(index, "key", event.target.value)}
                              type="password"
                              value={entry.key}
                            />
                            <Input
                              label={t("tokenLimit")}
                              labelMode="stacked"
                              min={1}
                              onChange={(event) => updateApiKey(index, "token_limit", Number(event.target.value))}
                              type="number"
                              value={entry.token_limit}
                            />
                            <Button
                              aria-label={t("deleteKey")}
                              className="self-center"
                              onClick={() => removeApiKey(index)}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              {t("deleteKey")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          <Button className="w-full" disabled={!showCharts && hasInvalidApiKeys} isLoading={isSaving} onClick={save}>
            {t("save")}
          </Button>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <UsageCard label={t("today")} tokens={totals.today} />
        <UsageCard label={t("week")} tokens={totals.week} />
        <UsageCard label={t("month")} tokens={totals.month} />
      </section>

      {showCharts ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-sigma-text">{t("tokenTrend")}</h2>
            <TokenTrendChart data={trendData} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-sigma-text">{t("usageByFunction")}</h2>
            <FunctionUsageChart data={functionData} />
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function UsageCard({ label, tokens }: { label: string; tokens: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sigma-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-sigma-text">{tokens.toLocaleString()}</p>
          <p className="mt-1 text-xs text-sigma-muted">${(tokens * tokenCost).toFixed(2)}</p>
        </div>
        <DollarSign className="h-5 w-5 text-sigma-muted" aria-hidden />
      </div>
    </Card>
  );
}
