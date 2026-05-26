"use client";

import { Gauge, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { LLMApiKey, LLMConfig, LLMProvider, LLMUsageResponse } from "@/lib/types";

const apiKeyProviders: LLMProvider[] = ["anthropic", "openai", "deepseek", "minimax", "kimi", "gemini"];

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
  daily_token_limit: 1_000_000,
  cost_guard_enabled: true,
  api_keys: []
};

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function normalizedLLMConfig(config: LLMConfig): LLMConfig {
  const apiKeys = (config.api_keys ?? []).map((entry) => ({
    ...entry,
    is_default: Boolean(entry.is_default),
    provider: entry.provider || "anthropic",
    token_limit: entry.token_limit || 1_000_000
  }));
  if (apiKeys.length === 0) {
    apiKeys.push({
      is_default: true,
      key: "",
      name: "",
      provider: "anthropic",
      token_limit: 1_000_000
    });
  }
  return {
    ...config,
    api_keys: apiKeys
  };
}

export function llmConfigsEqual(left: LLMConfig, right: LLMConfig) {
  return (
    left.daily_token_limit === right.daily_token_limit &&
    left.cost_guard_enabled === right.cost_guard_enabled &&
    llmApiKeysEqual(left.api_keys, right.api_keys)
  );
}

function llmApiKeysEqual(left: LLMApiKey[], right: LLMApiKey[]) {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        entry.name === other.name &&
        entry.key === other.key &&
        entry.provider === other.provider &&
        entry.token_limit === other.token_limit &&
        entry.is_default === other.is_default
      );
    })
  );
}

export function normalizedLLMConfigForSave(config: LLMConfig): LLMConfig {
  const apiKeys = (config.api_keys ?? [])
    .filter((entry) => !apiKeyIsBlank(entry))
    .map((entry) => ({
      ...entry,
      is_default: Boolean(entry.is_default),
      provider: entry.provider || "anthropic",
      token_limit: entry.token_limit || 1_000_000
    }));
  const hasDefault = apiKeys.some((entry) => entry.is_default);
  return {
    ...config,
    api_keys: apiKeys.map((entry, index) => ({
      ...entry,
      is_default: entry.is_default || (!hasDefault && index === 0)
    }))
  };
}

function apiKeyIsBlank(entry: LLMApiKey) {
  return entry.name.trim().length === 0 && entry.key.trim().length === 0;
}

function apiKeyIsInvalid(entry: LLMApiKey) {
  return (
    !apiKeyIsBlank(entry) &&
    (entry.name.trim().length === 0 ||
      entry.key.trim().length === 0 ||
      entry.provider.trim().length === 0)
  );
}

interface LLMSettingsPanelProps {
  configData?: LLMConfig;
  hideSaveButton?: boolean;
  ignoreDailyLimitCooldown?: boolean;
  isConfigLoading?: boolean;
  isSaving: boolean;
  onConfigRefetch?: () => Promise<unknown> | unknown;
  onDraftChange?: (form: LLMConfig, meta: { hasInvalidApiKeys: boolean }) => void;
  onSave: (form: LLMConfig) => Promise<unknown>;
  preserveDirtyDraft?: boolean;
  showCharts?: boolean;
  usageData?: LLMUsageResponse;
}

export function LLMSettingsPanel({
  configData,
  hideSaveButton = false,
  ignoreDailyLimitCooldown = false,
  isConfigLoading = false,
  isSaving,
  onConfigRefetch,
  onDraftChange,
  onSave,
  preserveDirtyDraft = false,
  showCharts = false,
  usageData
}: LLMSettingsPanelProps) {
  const t = useTranslations("admin.llm");
  const locale = useLocale();
  const toast = useToast();
  const [form, setForm] = useState<LLMConfig>(defaultConfig);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [tokenLimitDraft, setTokenLimitDraft] = useState(defaultConfig.daily_token_limit);
  const lastAppliedConfigRef = useRef<LLMConfig | null>(null);
  const savedTokenLimitRef = useRef(defaultConfig.daily_token_limit);
  const formRef = useRef<LLMConfig>(defaultConfig);
  const wasCooldownActiveRef = useRef(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    if (configData) {
      const nextForm = normalizedLLMConfig(configData);
      if (lastAppliedConfigRef.current && llmConfigsEqual(nextForm, lastAppliedConfigRef.current)) {
        return;
      }
      if (
        preserveDirtyDraft &&
        lastAppliedConfigRef.current &&
        !llmConfigsEqual(formRef.current, lastAppliedConfigRef.current) &&
        !llmConfigsEqual(nextForm, formRef.current)
      ) {
        return;
      }
      lastAppliedConfigRef.current = nextForm;
      savedTokenLimitRef.current = nextForm.daily_token_limit;
      setTokenLimitDraft(nextForm.daily_token_limit);
      setForm(nextForm);
      return;
    }
    if (!isConfigLoading) {
      const nextForm: LLMConfig = {
        ...defaultConfig,
        api_keys: [
          {
            is_default: true,
            key: "",
            name: "",
            provider: "anthropic",
            token_limit: 1_000_000
          }
        ]
      };
      if (lastAppliedConfigRef.current && llmConfigsEqual(nextForm, lastAppliedConfigRef.current)) {
        return;
      }
      if (
        preserveDirtyDraft &&
        lastAppliedConfigRef.current &&
        !llmConfigsEqual(formRef.current, lastAppliedConfigRef.current) &&
        !llmConfigsEqual(nextForm, formRef.current)
      ) {
        return;
      }
      lastAppliedConfigRef.current = nextForm;
      savedTokenLimitRef.current = nextForm.daily_token_limit;
      setTokenLimitDraft(nextForm.daily_token_limit);
      setForm(nextForm);
    }
  }, [configData, isConfigLoading, preserveDirtyDraft, t]);

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
    const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const days = Array.from({ length: 14 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (13 - index));
      const key = day.toISOString().slice(0, 10);
      return { day: formatter.format(day), input: 0, key, output: 0 };
    });
    for (const item of usageData?.items ?? []) {
      const key = item.day.slice(0, 10);
      const row = days.find((entry) => entry.key === key);
      if (row) {
        row.input += item.input_tokens;
        row.output += item.output_tokens;
      }
    }
    return days.map(({ day, input, output }) => ({ day, input, output }));
  }, [locale, usageData]);

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

    const totalTokens = Array.from(usageByProvider.values()).reduce((total, tokens) => total + tokens, 0);
    return Array.from(usageByProvider.entries()).map(([provider, tokens], index) => {
      const providerName = apiKeyProviders.includes(provider as LLMProvider)
        ? t(`providers.${provider as LLMProvider}`)
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
  const usageRemaining = Math.max(0, Math.round(form.daily_token_limit - totals.today));
  const usageRemainingPercent =
    form.daily_token_limit > 0 ? Math.max(0, Math.round((usageRemaining / form.daily_token_limit) * 100)) : 0;
  const cooldownSeconds = configData?.daily_token_limit_cooldown_remaining_seconds ?? 0;
  const isDailyLimitCooldownActive = !ignoreDailyLimitCooldown && cooldownRemainingSeconds > 0;
  const hasExplicitDefault = form.api_keys.some((entry) => entry.is_default);
  const tokenLimitSaveTarget = hideSaveButton ? form.daily_token_limit : savedTokenLimitRef.current;
  const hasTokenLimitDraftChange = tokenLimitDraft !== tokenLimitSaveTarget;

  const hasInvalidApiKeys = form.api_keys.some((entry) => apiKeyIsInvalid(entry));

  const providerOptions = apiKeyProviders.map((provider) => ({
    label: t(`providers.${provider}`),
    value: provider
  }));

  const formForSave = useMemo(
    () => normalizedLLMConfigForSave(form),
    [form]
  );

  useEffect(() => {
    setCooldownRemainingSeconds(cooldownSeconds);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!isDailyLimitCooldownActive) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setCooldownRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isDailyLimitCooldownActive]);

  useEffect(() => {
    if (isDailyLimitCooldownActive) {
      wasCooldownActiveRef.current = true;
      return;
    }
    if (wasCooldownActiveRef.current && cooldownRemainingSeconds === 0) {
      wasCooldownActiveRef.current = false;
      void onConfigRefetch?.();
    }
  }, [cooldownRemainingSeconds, isDailyLimitCooldownActive, onConfigRefetch]);

  useEffect(() => {
    onDraftChange?.(formForSave, { hasInvalidApiKeys });
  }, [formForSave, hasInvalidApiKeys, onDraftChange]);

  function addApiKey() {
    setForm({
      ...form,
      api_keys: [
        ...form.api_keys,
        {
          is_default: form.api_keys.length === 0,
          key: "",
          name: "",
          provider: "anthropic",
          token_limit: 1_000_000
        }
      ]
    });
  }

  function updateApiKey(index: number, field: keyof LLMApiKey, value: string | number | boolean) {
    setForm({
      ...form,
      api_keys: form.api_keys.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      )
    });
  }

  function setDefaultApiKey(index: number) {
    setForm({
      ...form,
      api_keys: form.api_keys.map((entry, entryIndex) => ({
        ...entry,
        is_default: entryIndex === index
      }))
    });
  }

  function removeApiKey(index: number) {
    const nextKeys = form.api_keys.filter((_, entryIndex) => entryIndex !== index);
    const normalizedKeys = nextKeys.some((entry) => entry.is_default)
      ? nextKeys
      : nextKeys.map((entry, entryIndex) => ({ ...entry, is_default: entryIndex === 0 }));
    setForm({
      ...form,
      api_keys: normalizedKeys
    });
  }

  async function save() {
    try {
      await onSave(formForSave);
      toast.showToast(t("saved"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  }

  async function saveTokenLimit() {
    if (!hasTokenLimitDraftChange || isDailyLimitCooldownActive) {
      return;
    }
    const nextForm = { ...form, daily_token_limit: tokenLimitDraft };
    if (hideSaveButton) {
      setForm(nextForm);
      return;
    }
    const payload = normalizedLLMConfigForSave(nextForm);
    try {
      await onSave(payload);
      savedTokenLimitRef.current = tokenLimitDraft;
      setForm(nextForm);
      toast.showToast(t("saved"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  }

  function formatCooldownCountdown(totalSeconds: number) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  if (isConfigLoading) {
    return <Skeleton className="h-80 rounded-2xl" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <section className="space-y-4">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Card className="flex h-[16rem] flex-col gap-3 p-5">
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
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {form.api_keys.map((entry, index) => {
                    const isDefault = entry.is_default || (!hasExplicitDefault && index === 0);
                    return (
                      <div
                        className={cn(
                          "grid items-end gap-2 rounded-lg p-2 lg:grid-cols-[auto_0.85fr_1fr_1fr_auto]",
                          isDefault ? "bg-primary/5" : "bg-sigma-elevated"
                        )}
                        key={index}
                      >
                        <div className="flex h-12 items-center justify-center px-1">
                          <ToggleSwitch
                            checked={isDefault}
                            label={t("selectKey")}
                            onChange={() => setDefaultApiKey(index)}
                          />
                        </div>
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
                        <div className="flex h-12 items-center justify-center">
                          <Button
                            aria-label={t("deleteKey")}
                            onClick={() => removeApiKey(index)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!hideSaveButton ? (
              <Button className="w-full" disabled={!showCharts && hasInvalidApiKeys} isLoading={isSaving} onClick={save}>
                {t("save")}
              </Button>
            ) : null}
          </Card>
          <Card className="flex h-[16rem] flex-col gap-4 p-4">
            <label className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-sigma-text">
              <ToggleSwitch
                checked={form.cost_guard_enabled}
                label={t("costGuard")}
                onChange={(checked) => setForm({ ...form, cost_guard_enabled: checked })}
              />
              <ShieldCheck className="h-4 w-4 text-sigma-muted" aria-hidden />
              {t("costGuard")}
            </label>
            <div className={cn(!form.cost_guard_enabled && "pointer-events-none select-none opacity-40")}>
              <div className={cn("flex items-end gap-2", isDailyLimitCooldownActive && "select-none opacity-40")}>
                <div className="min-w-0 flex-[2]">
                  <TokenLimitInput
                    disabled={isDailyLimitCooldownActive}
                    label={t("dailyLimit")}
                    onChange={setTokenLimitDraft}
                    value={form.cost_guard_enabled ? tokenLimitDraft : defaultConfig.daily_token_limit}
                  />
                </div>
                {!isDailyLimitCooldownActive ? (
                  <Button
                    className="shrink-0"
                    disabled={!hasTokenLimitDraftChange || (!hideSaveButton && hasInvalidApiKeys)}
                    isLoading={isSaving}
                    onClick={saveTokenLimit}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {t("saveLimit")}
                  </Button>
                ) : null}
              </div>
              {isDailyLimitCooldownActive ? (
                <p className="mt-2 text-xs font-medium text-sigma-muted">
                  {t("limitCooldown", { countdown: formatCooldownCountdown(cooldownRemainingSeconds) })}
                </p>
              ) : null}
            </div>
            <div className="mt-auto flex items-center gap-3 rounded-lg bg-sigma-elevated px-3 py-3">
              <Gauge className="h-4 w-4 shrink-0 text-sigma-muted" aria-hidden />
              <p className="min-w-0 flex-1 text-sm text-sigma-muted">{t("usageRemaining")}</p>
              <p className="text-xl font-bold text-sigma-text">{usageRemainingPercent}%</p>
            </div>
          </Card>
        </section>
        <section className="grid gap-4 xl:grid-cols-[3fr_1fr]">
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-sigma-text">{t("tokenTrend")}</h2>
            <TokenTrendChart data={trendData} locale={locale} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-sigma-text">{t("usageByFunction")}</h2>
            <FunctionUsageChart data={functionData} />
          </Card>
        </section>
        <section className="grid grid-cols-3 gap-4">
          <UsageCard label={t("today")} tokens={totals.today} />
          <UsageCard label={t("week")} tokens={totals.week} />
          <UsageCard label={t("month")} tokens={totals.month} />
        </section>
        {showCharts ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold text-foreground">{t("providerUsageDistribution")}</h3>
              {providerDistributionData.length > 0 ? (
                <ProviderUsageDistributionChart data={providerDistributionData} />
              ) : (
                <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  {t("noUsageData")}
                </div>
              )}
            </Card>
            <Card className={cn("space-y-4 p-5", !form.cost_guard_enabled && "pointer-events-none select-none opacity-40")}>
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
        ) : null}
      </section>
    </div>
  );
}

function TokenLimitInput({
  disabled = false,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const [rawValue, setRawValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  function handleChange(nextRaw: string) {
    setRawValue(nextRaw);
    const parsed = parseTokenAmount(nextRaw);
    if (parsed !== null && parsed > 0) {
      onChange(parsed);
    }
  }

  return (
    <Input
      label={label}
      labelMode="stacked"
      onBlur={() => {
        setIsEditing(false);
        setRawValue("");
      }}
      onChange={(event) => handleChange(event.target.value)}
      onFocus={() => {
        setIsEditing(true);
        setRawValue(String(value));
      }}
      disabled={disabled}
      type="text"
      value={isEditing ? rawValue : value.toLocaleString()}
    />
  );
}

function parseTokenAmount(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(/,/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!match) {
    return null;
  }
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

function UsageCard({ label, tokens }: { label: string; tokens: number }) {
  const t = useTranslations("admin.llm");

  return (
    <Card className="flex items-center justify-between gap-4 px-5 py-5">
      <p className="text-sm font-medium text-sigma-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-sigma-text">{tokens.toLocaleString()}</p>
      <span className="text-xs font-medium text-sigma-muted">{t("tokens")}</span>
    </Card>
  );
}
