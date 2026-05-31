import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import type { LLMApiKey, LLMConfig, LLMProvider, LLMUsageResponse } from "@/lib/types";

import { apiKeyIsInvalid, apiKeyProviders, chartColors, dailyUsageRows, defaultConfig, formatCooldownCountdown, llmConfigsEqual, normalizedLLMConfig, normalizedLLMConfigForSave, trendRows, usageTotals } from "./LLMSettingsLogic";

export interface LLMSettingsPanelProps {
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

export function useLLMSettingsPanelState({ configData, hideSaveButton = false, ignoreDailyLimitCooldown = false, isConfigLoading = false, isSaving, onConfigRefetch, onDraftChange, onSave, preserveDirtyDraft = false, showCharts = false, usageData }: LLMSettingsPanelProps) {
  const t = useTranslations("admin.llm"), locale = useLocale(), toast = useToast();
  const [form, setForm] = useState<LLMConfig>(defaultConfig), [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0), [tokenLimitDraft, setTokenLimitDraft] = useState(defaultConfig.daily_token_limit);
  const lastAppliedConfigRef = useRef<LLMConfig | null>(null), savedTokenLimitRef = useRef(defaultConfig.daily_token_limit), formRef = useRef<LLMConfig>(defaultConfig), wasCooldownActiveRef = useRef(false);
  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => {
    const nextForm = configData ? normalizedLLMConfig(configData) : !isConfigLoading ? normalizedLLMConfig(defaultConfig) : null;
    if (!nextForm) return;
    if (lastAppliedConfigRef.current && llmConfigsEqual(nextForm, lastAppliedConfigRef.current)) return;
    if (preserveDirtyDraft && lastAppliedConfigRef.current && !llmConfigsEqual(formRef.current, lastAppliedConfigRef.current) && !llmConfigsEqual(nextForm, formRef.current)) return;
    lastAppliedConfigRef.current = nextForm;
    savedTokenLimitRef.current = nextForm.daily_token_limit;
    setTokenLimitDraft(nextForm.daily_token_limit);
    setForm(nextForm);
  }, [configData, isConfigLoading, preserveDirtyDraft]);
  const totals = useMemo(() => usageTotals(usageData), [usageData]);
  const trendData = useMemo(() => trendRows(usageData, locale), [locale, usageData]);
  const functionData = useMemo(() => {
    const rows = { report: 0, summary: 0 };
    for (const item of usageData?.items ?? []) rows[item.function_type] += item.total_tokens;
    return [{ name: t("functions.summary"), tokens: rows.summary }, { name: t("functions.report"), tokens: rows.report }];
  }, [t, usageData]);
  const providerDistributionData = useMemo(() => {
    const usageByProvider = new Map<string, number>();
    for (const item of usageData?.items ?? []) if (item.provider && item.total_tokens > 0) usageByProvider.set(item.provider, (usageByProvider.get(item.provider) ?? 0) + item.total_tokens);
    const totalTokens = Array.from(usageByProvider.values()).reduce((total, tokens) => total + tokens, 0);
    return Array.from(usageByProvider.entries()).map(([provider, tokens], index) => ({ color: chartColors[index % chartColors.length], name: `${apiKeyProviders.includes(provider as LLMProvider) ? t(`providers.${provider as LLMProvider}`) : provider} ${totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0}%`, tokens }));
  }, [t, usageData]);
  const dailyUsageData = useMemo(() => dailyUsageRows(usageData), [usageData]);
  const dailyBudgetPercent = form.daily_token_limit > 0 ? Math.min(100, Math.round((totals.today / form.daily_token_limit) * 100)) : 0;
  const usageRemaining = Math.max(0, Math.round(form.daily_token_limit - totals.today));
  const usageRemainingPercent = form.daily_token_limit > 0 ? Math.max(0, Math.round((usageRemaining / form.daily_token_limit) * 100)) : 0;
  const cooldownSeconds = configData?.daily_token_limit_cooldown_remaining_seconds ?? 0;
  const isDailyLimitCooldownActive = !ignoreDailyLimitCooldown && cooldownRemainingSeconds > 0;
  const hasExplicitDefault = form.api_keys.some((entry) => entry.is_default);
  const tokenLimitSaveTarget = hideSaveButton ? form.daily_token_limit : savedTokenLimitRef.current;
  const hasTokenLimitDraftChange = tokenLimitDraft !== tokenLimitSaveTarget;
  const hasInvalidApiKeys = form.api_keys.some((entry) => apiKeyIsInvalid(entry));
  const providerOptions = apiKeyProviders.map((provider) => ({ label: t(`providers.${provider}`), value: provider }));
  const formForSave = useMemo(() => normalizedLLMConfigForSave(form), [form]);
  useEffect(() => { setCooldownRemainingSeconds(cooldownSeconds); }, [cooldownSeconds]);
  useEffect(() => { if (!isDailyLimitCooldownActive) return; const intervalId = window.setInterval(() => setCooldownRemainingSeconds((current) => Math.max(0, current - 1)), 1000); return () => window.clearInterval(intervalId); }, [isDailyLimitCooldownActive]);
  useEffect(() => { if (isDailyLimitCooldownActive) { wasCooldownActiveRef.current = true; return; } if (wasCooldownActiveRef.current && cooldownRemainingSeconds === 0) { wasCooldownActiveRef.current = false; void onConfigRefetch?.(); } }, [cooldownRemainingSeconds, isDailyLimitCooldownActive, onConfigRefetch]);
  useEffect(() => { onDraftChange?.(formForSave, { hasInvalidApiKeys }); }, [formForSave, hasInvalidApiKeys, onDraftChange]);
  function addApiKey() { setForm({ ...form, api_keys: [...form.api_keys, { is_default: form.api_keys.length === 0, key: "", name: "", provider: "anthropic", token_limit: 1_000_000 }] }); }
  function updateApiKey(index: number, field: keyof LLMApiKey, value: string | number | boolean) { setForm({ ...form, api_keys: form.api_keys.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry) }); }
  function setDefaultApiKey(index: number) { setForm({ ...form, api_keys: form.api_keys.map((entry, entryIndex) => ({ ...entry, is_default: entryIndex === index })) }); }
  function removeApiKey(index: number) { const nextKeys = form.api_keys.filter((_, entryIndex) => entryIndex !== index); const normalizedKeys = nextKeys.some((entry) => entry.is_default) ? nextKeys : nextKeys.map((entry, entryIndex) => ({ ...entry, is_default: entryIndex === 0 })); setForm({ ...form, api_keys: normalizedKeys }); }
  async function save() { try { await onSave(formForSave); toast.showToast(t("saved"), "success"); } catch (error) { toast.showToast(error instanceof Error ? error.message : t("error"), "error"); } }
  async function saveTokenLimit() { if (!hasTokenLimitDraftChange || isDailyLimitCooldownActive) return; const nextForm = { ...form, daily_token_limit: tokenLimitDraft }; if (hideSaveButton) { setForm(nextForm); return; } const payload = normalizedLLMConfigForSave(nextForm); try { await onSave(payload); savedTokenLimitRef.current = tokenLimitDraft; setForm(nextForm); toast.showToast(t("saved"), "success"); } catch (error) { toast.showToast(error instanceof Error ? error.message : t("error"), "error"); } }
  return { addApiKey, cooldownRemainingSeconds, dailyBudgetPercent, dailyUsageData, form, functionData, hasExplicitDefault, hasInvalidApiKeys, hasTokenLimitDraftChange, hideSaveButton, isConfigLoading, isDailyLimitCooldownActive, isSaving, locale, providerDistributionData, providerOptions, removeApiKey, save, saveTokenLimit, setDefaultApiKey, setForm, setTokenLimitDraft, showCharts, tokenLimitDraft, totals, trendData, updateApiKey, usageRemainingPercent, formatCooldownCountdown };
}
