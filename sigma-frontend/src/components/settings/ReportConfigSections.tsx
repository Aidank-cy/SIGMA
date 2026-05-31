"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { cn } from "@/lib/cn";
import { toggleMultiSelection } from "@/lib/selection";
import type { ReportTimeRange, ReportType, UserReportConfig } from "@/lib/types";

import {
  defaultReportMaxTokens,
  defaultReportTimeRanges,
  generationTimeValidationError,
  maxTokensValidationError,
  monthlyPreview,
  monthlyRangeValidationError,
  normalizedTimeRange,
  parseIntegerInput,
  reportTypeIsActive,
  stripUndefinedTimeRange,
  tokenLimitReportTypes,
  weeklyPreview,
  weeklyRangeValidationError
} from "./ReportConfigLogic";

interface Option<T extends string = string> { label: string; value: T; }
interface ReportAdvancedSettingsModalProps { activeReportFrequencies: ReportType[]; isOpen: boolean; onClose: () => void; payload: UserReportConfig; setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void; }
interface TimeRangeFieldsProps { generationTimeError?: string; maxTokensInput: ReactNode; range?: ReportTimeRange; reportType: ReportType; setRange: (range: Partial<ReportTimeRange>) => void; }
interface FrequencyPillsProps<T extends string> { compact?: boolean; extraContent?: ReactNode; label: string; onChange: (value: T) => void; options: Array<Option<T>>; values: T[]; }
interface MultiSelectPillsProps<T extends string> { allLabel: string; compact?: boolean; label: string; onChange: (values: T[]) => void; options: Array<Option<T>>; values: T[]; }

export function ReportAdvancedSettingsModal({ activeReportFrequencies, isOpen, onClose, payload, setPayload }: ReportAdvancedSettingsModalProps) {
  const t = useTranslations("settings");
  const [draftMaxTokens, setDraftMaxTokens] = useState<Partial<Record<ReportType, string>>>({});
  const [draftTimeRanges, setDraftTimeRanges] = useState<Partial<Record<ReportType, ReportTimeRange>>>({});

  useEffect(() => {
    if (!isOpen) return;
    setDraftMaxTokens(Object.fromEntries(tokenLimitReportTypes.map((reportType) => [reportType, String(payload.max_tokens?.[reportType] ?? defaultReportMaxTokens[reportType] ?? 2000)])) as Partial<Record<ReportType, string>>);
    setDraftTimeRanges(Object.fromEntries(tokenLimitReportTypes.map((reportType) => [reportType, { ...(defaultReportTimeRanges[reportType] ?? {}), ...(payload.time_ranges?.[reportType] ?? {}) }])) as Partial<Record<ReportType, ReportTimeRange>>);
  }, [isOpen, payload.max_tokens, payload.time_ranges]);

  const validationErrors = tokenLimitReportTypes.flatMap((reportType) => {
    const maxTokensError = maxTokensValidationError(draftMaxTokens[reportType], t);
    const generationTimeError = generationTimeValidationError(normalizedTimeRange(reportType, draftTimeRanges[reportType]).generation_time, t);
    const rangeError = reportType === "weekly" ? weeklyRangeValidationError(draftTimeRanges.weekly, t) : reportType === "monthly" ? monthlyRangeValidationError(draftTimeRanges.monthly, t) : null;
    return [maxTokensError, generationTimeError, rangeError].filter((message): message is string => message !== null);
  });

  function saveAdvancedSettings() {
    if (validationErrors.length > 0) return;
    setPayload((current) => {
      const nextMaxTokens = { ...defaultReportMaxTokens, ...(current.max_tokens ?? {}) };
      const nextTimeRanges = { ...(current.time_ranges ?? {}) };
      for (const reportType of tokenLimitReportTypes) {
        const parsed = Number.parseInt(draftMaxTokens[reportType] ?? "", 10);
        nextMaxTokens[reportType] = Number.isInteger(parsed) && parsed > 0 ? parsed : (defaultReportMaxTokens[reportType] ?? 2000);
        nextTimeRanges[reportType] = stripUndefinedTimeRange(normalizedTimeRange(reportType, draftTimeRanges[reportType]));
      }
      return { ...current, max_tokens: nextMaxTokens, time_ranges: nextTimeRanges };
    });
    onClose();
  }

  return (
    <Modal className="max-w-[110rem]" closeLabel={t("password.close")} isOpen={isOpen} onClose={onClose} title={t("reports.advancedSettingsTitle")}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-6 sm:grid-cols-2">
          {tokenLimitReportTypes.map((reportType) => <AdvancedReportCard activeReportFrequencies={activeReportFrequencies} draftMaxTokens={draftMaxTokens} draftTimeRanges={draftTimeRanges} key={reportType} reportType={reportType} setDraftMaxTokens={setDraftMaxTokens} setDraftTimeRanges={setDraftTimeRanges} />)}
        </div>
        {validationErrors.length > 0 ? <ValidationErrors errors={validationErrors} /> : null}
        <div className="flex justify-end"><Button disabled={validationErrors.length > 0} onClick={saveAdvancedSettings} type="button">{t("save")}</Button></div>
      </div>
    </Modal>
  );
}

function AdvancedReportCard({
  activeReportFrequencies,
  draftMaxTokens,
  draftTimeRanges,
  reportType,
  setDraftMaxTokens,
  setDraftTimeRanges
}: { activeReportFrequencies: ReportType[]; draftMaxTokens: Partial<Record<ReportType, string>>; draftTimeRanges: Partial<Record<ReportType, ReportTimeRange>>; reportType: ReportType; setDraftMaxTokens: (value: (current: Partial<Record<ReportType, string>>) => Partial<Record<ReportType, string>>) => void; setDraftTimeRanges: (value: (current: Partial<Record<ReportType, ReportTimeRange>>) => Partial<Record<ReportType, ReportTimeRange>>) => void; }) {
  const t = useTranslations("settings");
  const label = t(`reports.${reportType}`);
  const isActive = reportTypeIsActive(reportType, activeReportFrequencies);
  const maxTokensError = maxTokensValidationError(draftMaxTokens[reportType], t);
  const generationTimeError = generationTimeValidationError(normalizedTimeRange(reportType, draftTimeRanges[reportType]).generation_time, t);
  const maxTokensInput = <Input error={maxTokensError ?? undefined} inputMode="numeric" label={t("reports.maxTokensLabel", { label })} labelMode="stacked" min={1} max={50000} onChange={(event) => setDraftMaxTokens((current) => ({ ...current, [reportType]: event.target.value }))} type="number" value={draftMaxTokens[reportType] ?? ""} />;
  return (
    <div className={cn("space-y-3 rounded-xl bg-secondary p-3", !isActive && "pointer-events-none select-none opacity-60")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">{label}</h3>
        {!isActive ? <span className="rounded-full bg-card px-2.5 py-1 text-xs font-bold text-muted-foreground">{t("reports.notActive")}</span> : null}
      </div>
      <TimeRangeFields generationTimeError={generationTimeError ?? undefined} maxTokensInput={maxTokensInput} reportType={reportType} range={draftTimeRanges[reportType]} setRange={(next) => setDraftTimeRanges((current) => ({ ...current, [reportType]: { ...(defaultReportTimeRanges[reportType] ?? {}), ...(current[reportType] ?? {}), ...next } }))} />
    </div>
  );
}

function ValidationErrors({ errors }: { errors: string[] }) {
  return <div className="space-y-1 rounded-xl bg-destructive/10 p-3">{Array.from(new Set(errors)).map((error) => <p className="text-xs font-bold text-destructive" key={error}>{error}</p>)}</div>;
}

function TimeRangeFields({ generationTimeError, maxTokensInput, range, reportType, setRange }: TimeRangeFieldsProps) {
  if (reportType === "daily_morning") return <DailyMorningTimeRangeFields generationTimeError={generationTimeError} maxTokensInput={maxTokensInput} range={range} setRange={setRange} />;
  if (reportType === "daily_afternoon") return <DailyAfternoonTimeRangeFields generationTimeError={generationTimeError} maxTokensInput={maxTokensInput} range={range} setRange={setRange} />;
  if (reportType === "weekly") return <WeeklyTimeRangeFields generationTimeError={generationTimeError} maxTokensInput={maxTokensInput} range={range} setRange={setRange} />;
  if (reportType === "monthly") return <MonthlyTimeRangeFields generationTimeError={generationTimeError} maxTokensInput={maxTokensInput} range={range} setRange={setRange} />;
  return null;
}

function DailyMorningTimeRangeFields({ generationTimeError, maxTokensInput, range, setRange }: Omit<TimeRangeFieldsProps, "reportType">) {
  const t = useTranslations("settings");
  const resolved = { ...defaultReportTimeRanges.daily_morning, ...(range ?? {}) };
  return <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><ReadOnlyTimeRange label={t("reports.timeRange")} value={t("reports.dailyMorningRange")} /></div><GenerationTimeInput error={generationTimeError} onChange={(value) => setRange({ generation_time: value })} value={resolved.generation_time ?? "09:30"} />{maxTokensInput}</div>;
}

function DailyAfternoonTimeRangeFields({ generationTimeError, maxTokensInput, range, setRange }: Omit<TimeRangeFieldsProps, "reportType">) {
  const t = useTranslations("settings");
  const resolved = { ...defaultReportTimeRanges.daily_afternoon, ...(range ?? {}) };
  return <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><ReadOnlyTimeRange label={t("reports.timeRange")} value={t("reports.dailyAfternoonRange")} /></div><GenerationTimeInput error={generationTimeError} onChange={(value) => setRange({ generation_time: value })} value={resolved.generation_time ?? "17:45"} />{maxTokensInput}</div>;
}

function WeeklyTimeRangeFields({ generationTimeError, maxTokensInput, range, setRange }: Omit<TimeRangeFieldsProps, "reportType">) {
  const t = useTranslations("settings");
  const resolved = { ...defaultReportTimeRanges.weekly, ...(range ?? {}) };
  const weeklyError = weeklyRangeValidationError(resolved, t);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <WeeklyRangeRow label={t("reports.collectionStarts")} offset={resolved.start_day_offset ?? 7} onOffsetChange={(value) => setRange({ start_day_offset: value })} onTimeChange={(value) => setRange({ start_time: value })} time={resolved.start_time ?? "17:45"} timeLabel={t("reports.periodStartTime")} />
      <WeeklyRangeRow label={t("reports.collectionEnds")} offset={resolved.end_day_offset ?? 0} onOffsetChange={(value) => setRange({ end_day_offset: value })} onTimeChange={(value) => setRange({ end_time: value })} time={resolved.end_time ?? "17:44"} timeLabel={t("reports.periodEndTime")} />
      <GenerationDayTimeRow dayLabel={t("reports.generationDayOfWeek")} dayOptions={Array.from({ length: 7 }, (_, day) => ({ label: t(`reports.weekdays.${day}`), value: String(day) }))} dayValue={String(resolved.generation_day_of_week ?? 4)} error={generationTimeError} onDayChange={(value) => setRange({ generation_day_of_week: Number(value) })} onChange={(value) => setRange({ generation_time: value })} value={resolved.generation_time ?? "18:00"} />
      {maxTokensInput}<p className="text-xs leading-5 text-muted-foreground sm:col-span-2">{t("reports.weeklyHelper")}</p><div className="sm:col-span-2"><PreviewBox value={weeklyPreview(resolved, t)} /></div>
      {weeklyError ? <p className="text-xs font-bold text-destructive sm:col-span-2">{weeklyError}</p> : null}
    </div>
  );
}

function MonthlyTimeRangeFields({ generationTimeError, maxTokensInput, range, setRange }: Omit<TimeRangeFieldsProps, "reportType">) {
  const t = useTranslations("settings");
  const resolved = { ...defaultReportTimeRanges.monthly, ...(range ?? {}) };
  const error = monthlyRangeValidationError(resolved, t) ?? undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input error={error} inputMode="numeric" label={t("reports.fromDayOfMonth")} labelMode="stacked" min={1} max={31} onChange={(event) => setRange({ start_day_of_month: parseIntegerInput(event.target.value) ?? defaultReportTimeRanges.monthly?.start_day_of_month ?? 1 })} type="number" value={resolved.start_day_of_month ?? ""} />
      <Input inputMode="numeric" label={t("reports.toDayOfMonth")} labelMode="stacked" min={1} max={31} onChange={(event) => setRange({ end_day_of_month: parseIntegerInput(event.target.value) ?? defaultReportTimeRanges.monthly?.end_day_of_month ?? 28 })} type="number" value={resolved.end_day_of_month ?? ""} />
      <GenerationDayTimeRow dayLabel={t("reports.generationDayOfMonth")} dayOptions={Array.from({ length: 31 }, (_, index) => ({ label: String(index + 1), value: String(index + 1) }))} dayValue={String(resolved.generation_day_of_month ?? 1)} error={generationTimeError} onDayChange={(value) => setRange({ generation_day_of_month: Number(value) })} onChange={(value) => setRange({ generation_time: value })} value={resolved.generation_time ?? "09:00"} />
      {maxTokensInput}<div className="space-y-3 sm:col-span-2"><p className="text-xs leading-5 text-muted-foreground">{t("reports.monthlyHelper")}</p><PreviewBox value={monthlyPreview(resolved, t)} /></div>
    </div>
  );
}

function GenerationTimeInput({ error, onChange, value }: { error?: string; onChange: (value: string) => void; value: string }) {
  const t = useTranslations("settings");
  return <Input error={error} label={t("reports.generationTime")} labelMode="stacked" onChange={(event) => onChange(event.target.value)} type="time" value={value} />;
}

function GenerationDayTimeRow({ dayLabel, dayOptions, dayValue, error, onChange, onDayChange, value }: { dayLabel: string; dayOptions: Array<{ label: string; value: string }>; dayValue: string; error?: string; onChange: (value: string) => void; onDayChange: (value: string) => void; value: string; }) {
  const t = useTranslations("settings");
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,1fr)]"><CustomSelect label={dayLabel} labelMode="stacked" onChange={onDayChange} options={dayOptions} value={dayValue} /><Input error={error} label={t("reports.generationTime")} labelMode="stacked" onChange={(event) => onChange(event.target.value)} type="time" value={value} /></div>;
}

function WeeklyRangeRow({ label, offset, onOffsetChange, onTimeChange, time, timeLabel }: { label: string; offset: number; onOffsetChange: (value: number) => void; onTimeChange: (value: string) => void; time: string; timeLabel: string; }) {
  const t = useTranslations("settings");
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]"><CustomSelect label={label} labelMode="stacked" onChange={(value) => onOffsetChange(Number(value))} options={Array.from({ length: 15 }, (_, dayOffset) => ({ label: t("reports.daysBeforeReport", { count: dayOffset }), value: String(dayOffset) }))} value={String(offset)} /><Input label={timeLabel} labelMode="stacked" onChange={(event) => onTimeChange(event.target.value)} type="time" value={time} /></div>;
}

function PreviewBox({ value }: { value: string }) {
  const t = useTranslations("settings");
  return <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs font-bold text-muted-foreground">{t("reports.preview")}</p><p className="mt-1 text-sm font-bold text-foreground">{value}</p></div>;
}

function ReadOnlyTimeRange({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold text-foreground">{value}</p></div>;
}

export function ActiveReportToggle({ payload, setPayload }: { payload: UserReportConfig; setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void; }) {
  const t = useTranslations("settings");
  return <label className="flex items-center gap-2 text-sm font-bold text-foreground"><ToggleSwitch checked={payload.is_active} label={t("reports.active")} onChange={(checked) => setPayload((current) => ({ ...current, is_active: checked }))} />{t("reports.active")}</label>;
}

export function FrequencyPills<T extends string>({ compact = false, extraContent, label, onChange, options, values }: FrequencyPillsProps<T>) {
  return <div className="space-y-3"><p className="text-sm font-bold text-foreground">{label}</p><div className="flex flex-wrap items-center gap-2">{options.map((option) => <button className={values.includes(option.value) ? activePillClass(compact) : inactivePillClass(compact)} key={option.value} onClick={() => onChange(option.value)} type="button">{option.label}</button>)}{extraContent}</div></div>;
}

export function MultiSelectPills<T extends string>({ allLabel, compact = false, label, onChange, options, values }: MultiSelectPillsProps<T>) {
  return <div className="space-y-3"><p className="text-sm font-bold text-foreground">{label}</p><div className="flex flex-wrap gap-2"><button className={values.length === 0 ? activePillClass(compact) : inactivePillClass(compact)} onClick={() => onChange([])} type="button">{allLabel}</button>{options.map((option) => <button className={values.includes(option.value) ? activePillClass(compact) : inactivePillClass(compact)} key={option.value} onClick={() => onChange(toggleMultiSelection(values, option.value, options.length))} type="button">{option.label}</button>)}</div></div>;
}

function activePillClass(compact: boolean) {
  return cn("rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-all duration-200", compact ? "px-3 py-1.5" : "px-4 py-2");
}

function inactivePillClass(compact: boolean) {
  return cn("rounded-xl bg-muted text-sm font-bold text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground", compact ? "px-3 py-1.5" : "px-4 py-2");
}
