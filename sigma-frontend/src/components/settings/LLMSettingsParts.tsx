"use client";

import { Gauge, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { cn } from "@/lib/cn";

import { defaultConfig, parseTokenAmount } from "./LLMSettingsLogic";
import type { useLLMSettingsPanelState } from "./LLMSettingsState";

type LLMState = ReturnType<typeof useLLMSettingsPanelState>;

const TokenTrendChart = dynamic(() => import("@/components/charts/LLMUsageCharts").then((module) => module.TokenTrendChart), { loading: () => <Skeleton className="h-72 w-full" />, ssr: false });
const FunctionUsageChart = dynamic(() => import("@/components/charts/LLMUsageCharts").then((module) => module.FunctionUsageChart), { loading: () => <Skeleton className="h-72 w-full" />, ssr: false });
const ProviderUsageDistributionChart = dynamic(() => import("@/components/charts/LLMUsageCharts").then((module) => module.ProviderUsageDistributionChart), { loading: () => <Skeleton className="h-72 w-full" />, ssr: false });
const DailyUsageSparkline = dynamic(() => import("@/components/charts/LLMUsageCharts").then((module) => module.DailyUsageSparkline), { loading: () => <Skeleton className="h-16 w-full" />, ssr: false });

export function LLMSettingsView({ state }: { state: LLMState }) {
  const t = useTranslations("admin.llm");
  if (state.isConfigLoading) return <Skeleton className="h-80 rounded-2xl" />;
  return (
    <div className="flex flex-1 flex-col gap-6">
      <section className="space-y-4">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <ApiKeysCard state={state} />
          <CostGuardCard state={state} />
        </section>
        <UsageCharts state={state} />
        <section className="grid grid-cols-3 gap-6">
          <UsageCard label={t("today")} tokens={state.totals.today} />
          <UsageCard label={t("week")} tokens={state.totals.week} />
          <UsageCard label={t("month")} tokens={state.totals.month} />
        </section>
        {state.showCharts ? <ExtendedUsageCharts state={state} /> : null}
      </section>
    </div>
  );
}

function ApiKeysCard({ state }: { state: LLMState }) {
  const t = useTranslations("admin.llm");
  return (
    <Card className="flex h-[20rem] flex-col gap-3 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-bold text-foreground">{t("apiKeys")}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("apiKeysCaption")}</p></div><Button onClick={state.addApiKey} size="sm" type="button" variant="secondary"><Plus className="h-4 w-4" aria-hidden />{t("addKey")}</Button></div>
      {state.form.api_keys.length === 0 ? <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">{t("emptyKeys")}</p> : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-2">{state.form.api_keys.map((entry, index) => <ApiKeyRow entry={entry} index={index} key={index} state={state} />)}</div></div>
      )}
      {!state.hideSaveButton ? <Button className="w-full" disabled={!state.showCharts && state.hasInvalidApiKeys} isLoading={state.isSaving} onClick={state.save}>{t("save")}</Button> : null}
    </Card>
  );
}

function ApiKeyRow({ entry, index, state }: { entry: LLMState["form"]["api_keys"][number]; index: number; state: LLMState }) {
  const t = useTranslations("admin.llm");
  const isDefault = entry.is_default || (!state.hasExplicitDefault && index === 0);
  return (
    <div className={cn("grid items-end gap-2 rounded-xl p-2 lg:grid-cols-[auto_0.85fr_1fr_1fr_auto]", isDefault ? "bg-primary/5" : "bg-secondary")}>
      <div className="flex h-12 items-center justify-center px-1"><ToggleSwitch checked={isDefault} label={t("selectKey")} onChange={() => state.setDefaultApiKey(index)} /></div>
      <CustomSelect labelMode="stacked" label={t("provider")} onChange={(value) => state.updateApiKey(index, "provider", value)} options={state.providerOptions} value={entry.provider} />
      <Input label={t("keyName")} labelMode="stacked" onChange={(event) => state.updateApiKey(index, "name", event.target.value)} value={entry.name} />
      <Input label={t("keyValue")} labelMode="stacked" onChange={(event) => state.updateApiKey(index, "key", event.target.value)} type="password" value={entry.key} />
      <div className="flex h-12 items-center justify-center"><Button aria-label={t("deleteKey")} onClick={() => state.removeApiKey(index)} size="sm" type="button" variant="ghost"><Trash2 className="h-4 w-4" aria-hidden /></Button></div>
    </div>
  );
}

function CostGuardCard({ state }: { state: LLMState }) {
  const t = useTranslations("admin.llm");
  return (
    <Card className="flex h-[20rem] flex-col gap-6 p-6">
      <label className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-foreground"><ToggleSwitch checked={state.form.cost_guard_enabled} label={t("costGuard")} onChange={(checked) => state.setForm({ ...state.form, cost_guard_enabled: checked })} /><ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />{t("costGuard")}</label>
      <div className={cn(!state.form.cost_guard_enabled && "pointer-events-none select-none opacity-40")}>
        <div className={cn("flex items-end gap-2", state.isDailyLimitCooldownActive && "select-none opacity-40")}><div className="min-w-0 flex-[2]"><TokenLimitInput disabled={state.isDailyLimitCooldownActive} label={t("dailyLimit")} onChange={state.setTokenLimitDraft} value={state.form.cost_guard_enabled ? state.tokenLimitDraft : defaultConfig.daily_token_limit} /></div>{!state.isDailyLimitCooldownActive ? <Button className="shrink-0" disabled={!state.hasTokenLimitDraftChange || (!state.hideSaveButton && state.hasInvalidApiKeys)} isLoading={state.isSaving} onClick={state.saveTokenLimit} size="sm" type="button" variant="secondary"><Save className="h-4 w-4" aria-hidden />{t("saveLimit")}</Button> : null}</div>
        {state.isDailyLimitCooldownActive ? <p className="mt-2 text-xs font-bold text-muted-foreground">{t("limitCooldown", { countdown: state.formatCooldownCountdown(state.cooldownRemainingSeconds) })}</p> : null}
      </div>
      <div className="mt-auto flex items-center gap-3 rounded-xl bg-secondary px-3 py-3"><Gauge className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><p className="min-w-0 flex-1 text-sm text-muted-foreground">{t("usageRemaining")}</p><p className="text-xl font-bold text-foreground">{state.usageRemainingPercent}%</p></div>
    </Card>
  );
}

function UsageCharts({ state }: { state: LLMState }) {
  const t = useTranslations("admin.llm");
  return <section className="grid gap-6 xl:grid-cols-[4fr_1fr]"><Card className="p-6"><h2 className="mb-4 text-[20px] font-bold text-foreground">{t("tokenTrend")}</h2><TokenTrendChart data={state.trendData} locale={state.locale} /></Card><Card className="p-6"><h2 className="mb-4 text-[20px] font-bold text-foreground">{t("usageByFunction")}</h2><FunctionUsageChart data={state.functionData} /></Card></section>;
}

function ExtendedUsageCharts({ state }: { state: LLMState }) {
  const t = useTranslations("admin.llm");
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <Card className="p-6"><h3 className="text-[20px] font-bold text-foreground">{t("providerUsageDistribution")}</h3>{state.providerDistributionData.length > 0 ? <ProviderUsageDistributionChart data={state.providerDistributionData} /> : <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">{t("noUsageData")}</div>}</Card>
      <Card className={cn("space-y-4 p-6", !state.form.cost_guard_enabled && "pointer-events-none select-none opacity-40")}><div><h3 className="text-[20px] font-bold text-foreground">{t("dailyTokenBudget")}</h3><p className="mt-2 text-sm text-muted-foreground">{t("dailyTokenBudgetCaption", { limit: state.form.daily_token_limit.toLocaleString(), tokens: state.totals.today.toLocaleString() })}</p></div><div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-foreground">{state.dailyBudgetPercent}%</span><span className="text-muted-foreground">{state.totals.today.toLocaleString()} / {state.form.daily_token_limit.toLocaleString()}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-1" style={{ width: `${state.dailyBudgetPercent}%` }} /></div></div><DailyUsageSparkline data={state.dailyUsageData} /></Card>
    </section>
  );
}

function TokenLimitInput({ disabled = false, label, onChange, value }: { disabled?: boolean; label: string; onChange: (value: number) => void; value: number }) {
  const [rawValue, setRawValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  function handleChange(nextRaw: string) { setRawValue(nextRaw); const parsed = parseTokenAmount(nextRaw); if (parsed !== null && parsed > 0) onChange(parsed); }
  return <Input label={label} labelMode="stacked" onBlur={() => { setIsEditing(false); setRawValue(""); }} onChange={(event) => handleChange(event.target.value)} onFocus={() => { setIsEditing(true); setRawValue(String(value)); }} disabled={disabled} type="text" value={isEditing ? rawValue : value.toLocaleString()} />;
}

function UsageCard({ label, tokens }: { label: string; tokens: number }) {
  const t = useTranslations("admin.llm");
  return <Card className="flex items-center justify-between gap-6 px-5 py-5"><p className="text-sm font-bold text-muted-foreground">{label}</p><p className="text-xl font-bold tabular-nums text-foreground">{tokens.toLocaleString()}</p><span className="text-xs font-bold text-muted-foreground">{t("tokens")}</span></Card>;
}
