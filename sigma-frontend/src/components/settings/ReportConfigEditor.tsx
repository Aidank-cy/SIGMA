"use client";

import { SlidersHorizontal } from "lucide-react";
import { memo, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { cn } from "@/lib/cn";
import { toggleMultiSelection } from "@/lib/selection";
import type { Category, Market, ReportTimeRange, ReportType, UserReportConfig } from "@/lib/types";

const categories: Category[] = ["politics", "finance", "technology", "macro"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw"];
const reportTypes: ReportType[] = ["daily", "daily_morning", "daily_afternoon", "weekly", "monthly"];
const tokenLimitReportTypes: ReportType[] = ["daily_morning", "daily_afternoon", "weekly", "monthly"];

export const defaultReportMaxTokens: Partial<Record<ReportType, number>> = {
  daily_morning: 2000,
  daily_afternoon: 2000,
  weekly: 3000,
  monthly: 4000
};

const defaultReportTimeRanges: Partial<Record<ReportType, ReportTimeRange>> = {
  daily_morning: {
    end_day_offset: 0,
    end_time: "09:20",
    generation_time: "09:30",
    start_day_offset: 1,
    start_time: "17:30"
  },
  daily_afternoon: {
    end_day_offset: 0,
    end_time: "17:30",
    generation_time: "17:45",
    start_day_offset: 0,
    start_time: "09:20"
  },
  weekly: {
    end_day_offset: 0,
    end_time: "17:44",
    generation_day_of_week: 4,
    generation_time: "18:00",
    start_day_offset: 7,
    start_time: "17:45"
  },
  monthly: {
    end_day_of_month: 28,
    generation_day_of_month: 1,
    generation_time: "09:00",
    start_day_of_month: 1
  }
};

export const defaultReportConfig: UserReportConfig = {
  categories: [],
  is_active: true,
  markets: [],
  max_tokens: defaultReportMaxTokens,
  report_frequency: "daily",
  report_frequencies: ["daily"],
  time_ranges: {}
};

interface Option<T extends string = string> {
  label: string;
  value: T;
}

type SettingsTranslator = ReturnType<typeof useTranslations>;

interface ReportConfigEditorProps {
  className?: string;
  compact?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  payload: UserReportConfig;
  saveLabel?: string;
  setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void;
  title?: string;
}

export const ReportConfigEditor = memo(function ReportConfigEditor({
  className,
  compact = false,
  isSaving = false,
  onSave,
  payload,
  saveLabel,
  setPayload,
  title
}: ReportConfigEditorProps) {
  const t = useTranslations("settings");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const activeReportFrequencies = reportFrequencies(payload);
  const disabledControlClass = !payload.is_active && "pointer-events-none select-none opacity-40";
  const advancedSettingsButton = (
    <Button
      className="ml-auto"
      onClick={() => setIsAdvancedOpen(true)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      {t("reports.advancedSettings")}
    </Button>
  );

  return (
    <Card className={cn("p-5", className)}>
      <div className={cn("flex flex-col", compact ? "gap-4" : "gap-5")}>
        {compact ? (
          <h2 className="text-base font-semibold text-foreground">{title ?? t("reports.title")}</h2>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-foreground">{title ?? t("reports.title")}</h2>
            <ActiveReportToggle payload={payload} setPayload={setPayload} />
          </div>
        )}
        <div className={cn("flex flex-col", compact ? "gap-4" : "gap-5")}>
          {compact ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <ActiveReportToggle payload={payload} setPayload={setPayload} />
              <div className={cn("min-w-0 flex-1", disabledControlClass)}>
                <FrequencyPills
                  compact
                  label={t("reports.frequency")}
                  onChange={(value) =>
                    setPayload((current) => {
                      const nextFrequencies = toggleReportFrequency(reportFrequencies(current), value);
                      return {
                        ...current,
                        report_frequency: nextFrequencies[0],
                        report_frequencies: nextFrequencies
                      };
                    })
                  }
                  options={reportTypes.map((value) => ({ label: t(`reports.${value}`), value }))}
                  values={activeReportFrequencies}
                  extraContent={advancedSettingsButton}
                />
              </div>
            </div>
          ) : (
            <div className={cn(disabledControlClass)}>
              <FrequencyPills
                compact={compact}
                label={t("reports.frequency")}
                onChange={(value) =>
                  setPayload((current) => {
                    const nextFrequencies = toggleReportFrequency(reportFrequencies(current), value);
                    return {
                      ...current,
                      report_frequency: nextFrequencies[0],
                      report_frequencies: nextFrequencies
                    };
                  })
                }
                options={reportTypes.map((value) => ({ label: t(`reports.${value}`), value }))}
                values={activeReportFrequencies}
                extraContent={advancedSettingsButton}
              />
            </div>
          )}
          <div className={cn(disabledControlClass)}>
            <MultiSelectPills
              allLabel={t("reports.allMarkets")}
              compact={compact}
              label={t("reports.markets")}
              onChange={(values) => setPayload((current) => ({ ...current, markets: values }))}
              options={markets.map((value) => ({ label: t(`markets.${value}`), value }))}
              values={payload.markets}
            />
          </div>
          <div className={cn(disabledControlClass)}>
            <MultiSelectPills
              allLabel={t("reports.allCategories")}
              compact={compact}
              label={t("reports.categories")}
              onChange={(values) => setPayload((current) => ({ ...current, categories: values }))}
              options={categories.map((value) => ({ label: t(`categories.${value}`), value }))}
              values={payload.categories}
            />
          </div>
          {onSave ? (
            <Button className="w-full" isLoading={isSaving} onClick={onSave} type="button">
              {saveLabel ?? t("save")}
            </Button>
          ) : null}
        </div>
      </div>
      <ReportAdvancedSettingsModal
        activeReportFrequencies={activeReportFrequencies}
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        payload={payload}
        setPayload={setPayload}
      />
    </Card>
  );
}, reportConfigEditorPropsEqual);

function reportConfigEditorPropsEqual(prev: ReportConfigEditorProps, next: ReportConfigEditorProps) {
  return (
    prev.className === next.className &&
    prev.compact === next.compact &&
    prev.isSaving === next.isSaving &&
    prev.onSave === next.onSave &&
    prev.saveLabel === next.saveLabel &&
    prev.setPayload === next.setPayload &&
    prev.title === next.title &&
    reportConfigsEqual(prev.payload, next.payload)
  );
}

function ReportAdvancedSettingsModal({
  activeReportFrequencies,
  isOpen,
  onClose,
  payload,
  setPayload
}: {
  activeReportFrequencies: ReportType[];
  isOpen: boolean;
  onClose: () => void;
  payload: UserReportConfig;
  setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void;
}) {
  const t = useTranslations("settings");
  const [draftMaxTokens, setDraftMaxTokens] = useState<Partial<Record<ReportType, string>>>({});
  const [draftTimeRanges, setDraftTimeRanges] = useState<Partial<Record<ReportType, ReportTimeRange>>>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraftMaxTokens(
      Object.fromEntries(
        tokenLimitReportTypes.map((reportType) => [
          reportType,
          String(payload.max_tokens?.[reportType] ?? defaultReportMaxTokens[reportType] ?? 2000)
        ])
      ) as Partial<Record<ReportType, string>>
    );
    setDraftTimeRanges(
      Object.fromEntries(
        tokenLimitReportTypes.map((reportType) => [
          reportType,
          {
            ...(defaultReportTimeRanges[reportType] ?? {}),
            ...(payload.time_ranges?.[reportType] ?? {})
          }
        ])
      ) as Partial<Record<ReportType, ReportTimeRange>>
    );
  }, [isOpen, payload.max_tokens, payload.time_ranges]);

  const validationErrors = tokenLimitReportTypes.flatMap((reportType) => {
    const maxTokensError = maxTokensValidationError(draftMaxTokens[reportType], t);
    const generationTimeError = generationTimeValidationError(
      normalizedTimeRange(reportType, draftTimeRanges[reportType]).generation_time,
      t
    );
    const rangeError =
      reportType === "weekly"
        ? weeklyRangeValidationError(draftTimeRanges.weekly, t)
        : reportType === "monthly"
          ? monthlyRangeValidationError(draftTimeRanges.monthly, t)
          : null;
    return [maxTokensError, generationTimeError, rangeError].filter((message): message is string => message !== null);
  });

  function saveAdvancedSettings() {
    if (validationErrors.length > 0) {
      return;
    }
    setPayload((current) => {
      const nextMaxTokens = { ...defaultReportMaxTokens, ...(current.max_tokens ?? {}) };
      const nextTimeRanges = { ...(current.time_ranges ?? {}) };
      for (const reportType of tokenLimitReportTypes) {
        const parsed = Number.parseInt(draftMaxTokens[reportType] ?? "", 10);
        nextMaxTokens[reportType] = parsed;
        nextTimeRanges[reportType] = normalizedTimeRange(reportType, draftTimeRanges[reportType]);
      }
      return {
        ...current,
        max_tokens: nextMaxTokens,
        time_ranges: nextTimeRanges
      };
    });
    onClose();
  }

  return (
    <Modal
      className="max-w-3xl"
      closeLabel={t("password.close")}
      isOpen={isOpen}
      onClose={onClose}
      title={t("reports.advancedSettingsTitle")}
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {tokenLimitReportTypes.map((reportType) => {
          const label = t(`reports.${reportType}`);
          const isActive = reportTypeIsActive(reportType, activeReportFrequencies);
          const maxTokensError = maxTokensValidationError(draftMaxTokens[reportType], t);
          const generationTimeError = generationTimeValidationError(
            normalizedTimeRange(reportType, draftTimeRanges[reportType]).generation_time,
            t
          );
          const maxTokensInput = (
            <Input
              error={maxTokensError ?? undefined}
              inputMode="numeric"
              label={t("reports.maxTokensLabel", { label })}
              labelMode="stacked"
              min={1}
              max={50000}
              onChange={(event) =>
                setDraftMaxTokens((current) => ({ ...current, [reportType]: event.target.value }))
              }
              type="number"
              value={draftMaxTokens[reportType] ?? ""}
            />
          );
          return (
            <div
              className={cn(
                "space-y-3 rounded-lg bg-sigma-elevated p-3",
                !isActive && "pointer-events-none select-none opacity-60"
              )}
              key={reportType}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-sigma-text">{label}</h3>
                {!isActive ? (
                  <span className="rounded-full bg-sigma-surface px-2.5 py-1 text-xs font-medium text-sigma-muted">
                    {t("reports.notActive")}
                  </span>
                ) : null}
              </div>
              <TimeRangeFields
                generationTimeError={generationTimeError ?? undefined}
                maxTokensInput={maxTokensInput}
                reportType={reportType}
                range={draftTimeRanges[reportType]}
                setRange={(next) =>
                  setDraftTimeRanges((current) => ({
                    ...current,
                    [reportType]: {
                      ...(defaultReportTimeRanges[reportType] ?? {}),
                      ...(current[reportType] ?? {}),
                      ...next
                    }
                  }))
                }
              />
            </div>
          );
        })}
        {validationErrors.length > 0 ? (
          <div className="space-y-1 rounded-lg bg-sigma-danger/10 p-3">
            {Array.from(new Set(validationErrors)).map((error) => (
              <p className="text-xs font-medium text-sigma-danger" key={error}>
                {error}
              </p>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button disabled={validationErrors.length > 0} onClick={saveAdvancedSettings} type="button">
            {t("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TimeRangeFields({
  generationTimeError,
  maxTokensInput,
  range,
  reportType,
  setRange
}: {
  generationTimeError?: string;
  maxTokensInput: ReactNode;
  range?: ReportTimeRange;
  reportType: ReportType;
  setRange: (range: Partial<ReportTimeRange>) => void;
}) {
  const t = useTranslations("settings");

  if (reportType === "daily_morning") {
    const resolved = { ...defaultReportTimeRanges.daily_morning, ...(range ?? {}) };
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadOnlyTimeRange label={t("reports.timeRange")} value={t("reports.dailyMorningRange")} />
        </div>
        <GenerationTimeInput
          error={generationTimeError}
          onChange={(value) => setRange({ generation_time: value })}
          value={resolved.generation_time ?? "09:30"}
        />
        {maxTokensInput}
      </div>
    );
  }
  if (reportType === "daily_afternoon") {
    const resolved = { ...defaultReportTimeRanges.daily_afternoon, ...(range ?? {}) };
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadOnlyTimeRange label={t("reports.timeRange")} value={t("reports.dailyAfternoonRange")} />
        </div>
        <GenerationTimeInput
          error={generationTimeError}
          onChange={(value) => setRange({ generation_time: value })}
          value={resolved.generation_time ?? "17:45"}
        />
        {maxTokensInput}
      </div>
    );
  }
  if (reportType === "weekly") {
    const resolved = { ...defaultReportTimeRanges.weekly, ...(range ?? {}) };
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <WeeklyRangeRow
          label={t("reports.collectionStarts")}
          offset={resolved.start_day_offset ?? 7}
          onOffsetChange={(value) => setRange({ start_day_offset: value })}
          onTimeChange={(value) => setRange({ start_time: value })}
          time={resolved.start_time ?? "17:45"}
          timeLabel={t("reports.periodStartTime")}
        />
        <WeeklyRangeRow
          label={t("reports.collectionEnds")}
          offset={resolved.end_day_offset ?? 0}
          onOffsetChange={(value) => setRange({ end_day_offset: value })}
          onTimeChange={(value) => setRange({ end_time: value })}
          time={resolved.end_time ?? "17:44"}
          timeLabel={t("reports.periodEndTime")}
        />
        <GenerationDayTimeRow
          dayLabel={t("reports.generationDayOfWeek")}
          dayOptions={Array.from({ length: 7 }, (_, day) => ({
            label: t(`reports.weekdays.${day}`),
            value: String(day)
          }))}
          dayValue={String(resolved.generation_day_of_week ?? 4)}
          error={generationTimeError}
          onDayChange={(value) => setRange({ generation_day_of_week: Number(value) })}
          onChange={(value) => setRange({ generation_time: value })}
          value={resolved.generation_time ?? "18:00"}
        />
        {maxTokensInput}
        <p className="text-xs leading-5 text-sigma-muted sm:col-span-2">{t("reports.weeklyHelper")}</p>
        <div className="sm:col-span-2">
          <PreviewBox value={weeklyPreview(resolved, t)} />
        </div>
        {weeklyRangeValidationError(resolved, t) ? (
          <p className="text-xs font-medium text-sigma-danger sm:col-span-2">
            {weeklyRangeValidationError(resolved, t)}
          </p>
        ) : null}
      </div>
    );
  }
  if (reportType === "monthly") {
    const resolved = { ...defaultReportTimeRanges.monthly, ...(range ?? {}) };
    const error = monthlyRangeValidationError(resolved, t) ?? undefined;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          error={error}
          inputMode="numeric"
          label={t("reports.fromDayOfMonth")}
          labelMode="stacked"
          min={1}
          max={31}
          onChange={(event) => setRange({ start_day_of_month: parseIntegerInput(event.target.value) })}
          type="number"
          value={resolved.start_day_of_month ?? ""}
        />
        <Input
          inputMode="numeric"
          label={t("reports.toDayOfMonth")}
          labelMode="stacked"
          min={1}
          max={31}
          onChange={(event) => setRange({ end_day_of_month: parseIntegerInput(event.target.value) })}
          type="number"
          value={resolved.end_day_of_month ?? ""}
        />
        <GenerationDayTimeRow
          dayLabel={t("reports.generationDayOfMonth")}
          dayOptions={Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            return {
              label: String(day),
              value: String(day)
            };
          })}
          dayValue={String(resolved.generation_day_of_month ?? 1)}
          error={generationTimeError}
          onDayChange={(value) => setRange({ generation_day_of_month: Number(value) })}
          onChange={(value) => setRange({ generation_time: value })}
          value={resolved.generation_time ?? "09:00"}
        />
        {maxTokensInput}
        <div className="space-y-3 sm:col-span-2">
          <p className="text-xs leading-5 text-sigma-muted">{t("reports.monthlyHelper")}</p>
          <PreviewBox value={monthlyPreview(resolved, t)} />
        </div>
      </div>
    );
  }
  return null;
}

function GenerationTimeInput({
  error,
  onChange,
  value
}: {
  error?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("settings");
  return (
    <Input
      error={error}
      label={t("reports.generationTime")}
      labelMode="stacked"
      onChange={(event) => onChange(event.target.value)}
      type="time"
      value={value}
    />
  );
}

function GenerationDayTimeRow({
  dayLabel,
  dayOptions,
  dayValue,
  error,
  onChange,
  onDayChange,
  value
}: {
  dayLabel: string;
  dayOptions: Array<{ label: string; value: string }>;
  dayValue: string;
  error?: string;
  onChange: (value: string) => void;
  onDayChange: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("settings");
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(8rem,0.75fr)]">
      <CustomSelect
        label={dayLabel}
        labelMode="stacked"
        onChange={onDayChange}
        options={dayOptions}
        value={dayValue}
      />
      <Input
        error={error}
        label={t("reports.generationTime")}
        labelMode="stacked"
        onChange={(event) => onChange(event.target.value)}
        type="time"
        value={value}
      />
    </div>
  );
}

function WeeklyRangeRow({
  label,
  offset,
  onOffsetChange,
  onTimeChange,
  time,
  timeLabel
}: {
  label: string;
  offset: number;
  onOffsetChange: (value: number) => void;
  onTimeChange: (value: string) => void;
  time: string;
  timeLabel: string;
}) {
  const t = useTranslations("settings");
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
      <CustomSelect
        label={label}
        labelMode="stacked"
        onChange={(value) => onOffsetChange(Number(value))}
        options={Array.from({ length: 15 }, (_, dayOffset) => ({
          label: t("reports.daysBeforeReport", { count: dayOffset }),
          value: String(dayOffset)
        }))}
        value={String(offset)}
      />
      <Input
        label={timeLabel}
        labelMode="stacked"
        onChange={(event) => onTimeChange(event.target.value)}
        type="time"
        value={time}
      />
    </div>
  );
}

function PreviewBox({ value }: { value: string }) {
  const t = useTranslations("settings");
  return (
    <div className="rounded-lg border border-sigma-line bg-sigma-surface px-4 py-3">
      <p className="text-xs font-medium text-sigma-muted">{t("reports.preview")}</p>
      <p className="mt-1 text-sm font-medium text-sigma-text">{value}</p>
    </div>
  );
}

function ReadOnlyTimeRange({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-sigma-line bg-sigma-surface px-4 py-3">
      <p className="text-xs font-medium text-sigma-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-sigma-text">{value}</p>
    </div>
  );
}

function ActiveReportToggle({
  payload,
  setPayload
}: {
  payload: UserReportConfig;
  setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void;
}) {
  const t = useTranslations("settings");

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      <ToggleSwitch
        checked={payload.is_active}
        label={t("reports.active")}
        onChange={(checked) => setPayload((current) => ({ ...current, is_active: checked }))}
      />
      {t("reports.active")}
    </label>
  );
}

function FrequencyPills<T extends string>({
  compact = false,
  extraContent,
  label,
  onChange,
  options,
  values
}: {
  compact?: boolean;
  extraContent?: ReactNode;
  label: string;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  values: T[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <button
            className={values.includes(option.value) ? activePillClass(compact) : inactivePillClass(compact)}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
        {extraContent}
      </div>
    </div>
  );
}

function MultiSelectPills<T extends string>({
  allLabel,
  compact = false,
  label,
  onChange,
  options,
  values
}: {
  allLabel: string;
  compact?: boolean;
  label: string;
  onChange: (values: T[]) => void;
  options: Array<Option<T>>;
  values: T[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        <button
          className={values.length === 0 ? activePillClass(compact) : inactivePillClass(compact)}
          onClick={() => onChange([])}
          type="button"
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            className={values.includes(option.value) ? activePillClass(compact) : inactivePillClass(compact)}
            key={option.value}
            onClick={() => onChange(toggleMultiSelection(values, option.value, options.length))}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function activePillClass(compact: boolean) {
  return cn(
    "rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-all duration-200",
    compact ? "px-3 py-1.5" : "px-4 py-2"
  );
}

function inactivePillClass(compact: boolean) {
  return cn(
    "rounded-xl bg-muted text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground",
    compact ? "px-3 py-1.5" : "px-4 py-2"
  );
}

export function reportConfigsEqual(left: UserReportConfig, right: UserReportConfig) {
  return (
    left.is_active === right.is_active &&
    stringArraysEqual(reportFrequencies(left), reportFrequencies(right)) &&
    stringArraysEqual(left.categories, right.categories) &&
    stringArraysEqual(left.markets, right.markets) &&
    tokenLimitsEqual(left.max_tokens ?? {}, right.max_tokens ?? {}) &&
    timeRangesEqual(left.time_ranges ?? {}, right.time_ranges ?? {})
  );
}

export function normalizeReportConfig(config: UserReportConfig): UserReportConfig {
  return {
    ...config,
    max_tokens: { ...defaultReportMaxTokens, ...(config.max_tokens ?? {}) },
    report_frequencies: reportFrequencies(config),
    time_ranges: { ...(config.time_ranges ?? {}) }
  };
}

function reportFrequencies(config: UserReportConfig): ReportType[] {
  const frequencies = config.report_frequencies ?? (config.report_frequency ? [config.report_frequency] : []);
  return frequencies.length > 0 ? normalizeReportFrequencySelection(frequencies) : ["daily"];
}

function toggleReportFrequency(current: ReportType[], value: ReportType): ReportType[] {
  if (value === "daily") {
    return normalizeReportFrequencySelection([
      ...current.filter((entry) => entry !== "daily_morning" && entry !== "daily_afternoon"),
      "daily"
    ]);
  }
  if (value === "daily_morning" || value === "daily_afternoon") {
    const withoutDaily = current.filter((entry) => entry !== "daily");
    const next = withoutDaily.includes(value)
      ? withoutDaily.filter((entry) => entry !== value)
      : [...withoutDaily, value];
    return normalizeReportFrequencySelection(next.length > 0 ? next : [value]);
  }
  const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  return normalizeReportFrequencySelection(next.length > 0 ? next : [value]);
}

function normalizeReportFrequencySelection(values: ReportType[]): ReportType[] {
  const unique = Array.from(new Set(values));
  if (unique.includes("daily")) {
    return unique.filter((value) => value !== "daily_morning" && value !== "daily_afternoon");
  }
  return reportTypes.filter((value) => unique.includes(value));
}

function reportTypeIsActive(reportType: ReportType, values: ReportType[]) {
  if (values.includes("daily")) {
    return reportType === "daily_morning" || reportType === "daily_afternoon";
  }
  return values.includes(reportType);
}

function stringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function tokenLimitsEqual(
  left: Partial<Record<ReportType, number>>,
  right: Partial<Record<ReportType, number>>
) {
  return tokenLimitReportTypes.every(
    (reportType) =>
      (left[reportType] ?? defaultReportMaxTokens[reportType]) ===
      (right[reportType] ?? defaultReportMaxTokens[reportType])
  );
}

function timeRangesEqual(
  left: Partial<Record<ReportType, ReportTimeRange>>,
  right: Partial<Record<ReportType, ReportTimeRange>>
) {
  return tokenLimitReportTypes.every((reportType) => reportTimeRangeEqual(left[reportType], right[reportType]));
}

function reportTimeRangeEqual(left?: ReportTimeRange, right?: ReportTimeRange) {
  return (
    (left?.start_day_offset ?? null) === (right?.start_day_offset ?? null) &&
    (left?.end_day_offset ?? null) === (right?.end_day_offset ?? null) &&
    (left?.start_time ?? "") === (right?.start_time ?? "") &&
    (left?.end_time ?? "") === (right?.end_time ?? "") &&
    (left?.generation_time ?? "") === (right?.generation_time ?? "") &&
    (left?.generation_day_of_week ?? null) === (right?.generation_day_of_week ?? null) &&
    (left?.generation_day_of_month ?? null) === (right?.generation_day_of_month ?? null) &&
    (left?.start_day_of_month ?? null) === (right?.start_day_of_month ?? null) &&
    (left?.end_day_of_month ?? null) === (right?.end_day_of_month ?? null)
  );
}

function normalizedTimeRange(reportType: ReportType, range?: ReportTimeRange): ReportTimeRange {
  return {
    ...(defaultReportTimeRanges[reportType] ?? {}),
    ...(range ?? {})
  };
}

function maxTokensValidationError(value: string | undefined, t: SettingsTranslator) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 50000) {
    return t("reports.maxTokensError");
  }
  return null;
}

function generationTimeValidationError(value: string | undefined, t: SettingsTranslator) {
  if (parseTimeToMinutes(value) === null) {
    return t("reports.generationTimeError");
  }
  return null;
}

function weeklyRangeValidationError(range: ReportTimeRange | undefined, t: SettingsTranslator) {
  const resolved = { ...defaultReportTimeRanges.weekly, ...(range ?? {}) };
  const startOffset = resolved.start_day_offset;
  const endOffset = resolved.end_day_offset;
  const startMinutes = parseTimeToMinutes(resolved.start_time);
  const endMinutes = parseTimeToMinutes(resolved.end_time);
  if (
    startOffset === undefined ||
    endOffset === undefined ||
    startMinutes === null ||
    endMinutes === null ||
    startOffset < 0 ||
    endOffset < 0 ||
    startOffset > 14 ||
    endOffset > 14
  ) {
    return t("reports.weeklyRangeInvalid");
  }
  const spanMinutes = (startOffset - endOffset) * 24 * 60 + endMinutes - startMinutes;
  if (spanMinutes <= 0) {
    return t("reports.weeklyRangeOrder");
  }
  if (spanMinutes < 24 * 60) {
    return t("reports.weeklyRangeTooShort");
  }
  if (spanMinutes > 14 * 24 * 60) {
    return t("reports.weeklyRangeTooLong");
  }
  return null;
}

function monthlyRangeValidationError(range: ReportTimeRange | undefined, t: SettingsTranslator) {
  const resolved = { ...defaultReportTimeRanges.monthly, ...(range ?? {}) };
  const startDay = resolved.start_day_of_month;
  const endDay = resolved.end_day_of_month;
  if (
    startDay === undefined ||
    endDay === undefined ||
    startDay < 1 ||
    startDay > 31 ||
    endDay < 1 ||
    endDay > 31
  ) {
    return t("reports.monthlyRangeInvalid");
  }
  if (startDay > endDay) {
    return t("reports.monthlyRangeOrder");
  }
  return null;
}

function parseIntegerInput(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseTimeToMinutes(value: string | undefined) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function weeklyPreview(range: ReportTimeRange, t: SettingsTranslator) {
  const startOffset = range.start_day_offset ?? 7;
  const endOffset = range.end_day_offset ?? 0;
  const startLabel = weeklyOffsetPreviewLabel(startOffset, endOffset, t);
  const endLabel = weeklyOffsetPreviewLabel(endOffset, startOffset, t);
  const spanDays = Math.round(
    ((startOffset - endOffset) * 24 * 60 +
      (parseTimeToMinutes(range.end_time) ?? 0) -
      (parseTimeToMinutes(range.start_time) ?? 0)) /
      (24 * 60)
  );
  return t("reports.weeklyPreview", {
    end: `${endLabel} ${range.end_time ?? "17:44"}`,
    span: Math.max(1, spanDays),
    start: `${startLabel} ${range.start_time ?? "17:45"}`
  });
}

function weeklyOffsetPreviewLabel(offset: number, pairedOffset: number, t: SettingsTranslator) {
  if (offset === 0) {
    return pairedOffset >= 7 ? t("reports.nextFriday") : t("reports.reportFriday");
  }
  if (offset === 7) {
    return t("reports.friday");
  }
  return t("reports.daysBeforeReportShort", { count: offset });
}

function monthlyPreview(range: ReportTimeRange, t: SettingsTranslator) {
  return t("reports.monthlyPreview", {
    end: ordinalDay(range.end_day_of_month ?? 28, t),
    start: ordinalDay(range.start_day_of_month ?? 1, t)
  });
}

function ordinalDay(day: number, t: SettingsTranslator) {
  if (t("reports.ordinalLocale") === "zh") {
    return t("reports.dayOfMonth", { day });
  }
  const remainder = day % 100;
  const suffix = remainder >= 11 && remainder <= 13 ? "th" : ["th", "st", "nd", "rd"][day % 10] ?? "th";
  return `${day}${suffix}`;
}
