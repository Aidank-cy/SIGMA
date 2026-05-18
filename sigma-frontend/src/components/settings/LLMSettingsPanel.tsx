"use client";

import { Bot, DollarSign, Plus, ShieldCheck, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useToast } from "@/components/ui/Toast";
import type { LLMConfig, LLMUsageResponse } from "@/lib/types";

const models = {
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-latest"],
  openai: ["gpt-4.1", "gpt-4.1-mini"]
} as const;

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

const defaultConfig: LLMConfig = {
  provider: "anthropic",
  model: models.anthropic[0],
  daily_token_limit: 1_000_000,
  cost_guard_enabled: true,
  api_keys: []
};

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
      setForm(configData);
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

  const hasInvalidApiKeys = form.api_keys.some(
    (entry) => entry.name.trim().length === 0 || entry.key.trim().length === 0
  );

  function addApiKey() {
    setForm({
      ...form,
      api_keys: [...form.api_keys, { key: "", name: t("newKeyName") }]
    });
  }

  function updateApiKey(index: number, field: "key" | "name", value: string) {
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
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sigma-accent/10 text-sigma-accent">
              <Bot className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sigma-muted">{t("current")}</p>
              <h2 className="mt-1 truncate text-xl font-semibold text-sigma-text">{form.model}</h2>
              <p className="mt-2 text-sm text-sigma-muted">
                {t(`providers.${form.provider}`)} · {t("keyCount", { count: form.api_keys.length })}
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t("provider")}
              onChange={(value) =>
                setForm({
                  ...form,
                  provider: value as LLMConfig["provider"],
                  model: models[value as LLMConfig["provider"]][0]
                })
              }
              value={form.provider}
            >
              <option value="anthropic">{t("providers.anthropic")}</option>
              <option value="openai">{t("providers.openai")}</option>
            </Select>
            <Select
              label={t("model")}
              onChange={(value) => setForm({ ...form, model: value })}
              value={form.model}
            >
              {models[form.provider].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label={t("dailyLimit")}
            min={1}
            onChange={(event) => setForm({ ...form, daily_token_limit: Number(event.target.value) })}
            type="number"
            value={form.daily_token_limit}
          />
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
              <div className="space-y-3">
                {form.api_keys.map((entry, index) => (
                  <div className="grid gap-3 rounded-lg bg-sigma-elevated p-3 lg:grid-cols-[0.8fr_1fr_auto]" key={index}>
                    <Input
                      label={t("keyName")}
                      onChange={(event) => updateApiKey(index, "name", event.target.value)}
                      value={entry.name}
                    />
                    <Input
                      label={t("keyValue")}
                      onChange={(event) => updateApiKey(index, "key", event.target.value)}
                      type="password"
                      value={entry.key}
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
            )}
          </section>
          <Button disabled={hasInvalidApiKeys} isLoading={isSaving} onClick={save}>
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

function Select({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-2 text-xs font-medium text-sigma-muted">
      <span>{label}</span>
      <select
        className="h-12 w-full rounded-2xl border border-sigma-line bg-sigma-elevated px-4 text-sm text-sigma-text outline-none focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}
