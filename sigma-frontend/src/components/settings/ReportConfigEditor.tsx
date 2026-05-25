"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
  weekly: {
    end_day_offset: 0,
    end_time: "17:44",
    start_day_offset: 7,
    start_time: "17:45"
  },
  monthly: {
    end_day_of_month: 28,
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

export function ReportConfigEditor({
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
              />
            </div>
          )}
          <div className={cn("-mt-2 flex justify-end", disabledControlClass)}>
            <Button
              className="self-start sm:self-end"
              onClick={() => setIsAdvancedOpen(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {t("reports.advancedSettings")}
            </Button>
          </div>
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
        enabledReportTypes={enabledReportTokenTypes(activeReportFrequencies)}
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        payload={payload}
        setPayload={setPayload}
      />
    </Card>
  );
}

function ReportAdvancedSettingsModal({
  enabledReportTypes,
  isOpen,
  onClose,
  payload,
  setPayload
}: {
  enabledReportTypes: ReportType[];
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
        enabledReportTypes.map((reportType) => [
          reportType,
          String(payload.max_tokens?.[reportType] ?? defaultReportMaxTokens[reportType] ?? 2000)
        ])
      ) as Partial<Record<ReportType, string>>
    );
    setDraftTimeRanges(
      Object.fromEntries(
        enabledReportTypes.map((reportType) => [
          reportType,
          {
            ...(defaultReportTimeRanges[reportType] ?? {}),
            ...(payload.time_ranges?.[reportType] ?? {})
          }
        ])
      ) as Partial<Record<ReportType, ReportTimeRange>>
    );
  }, [enabledReportTypes.join("|"), isOpen, payload.max_tokens, payload.time_ranges]);

  const validationErrors = enabledReportTypes.flatMap((reportType) => {
    const maxTokensError = maxTokensValidationError(draftMaxTokens[reportType], t);
    const rangeError =
      reportType === "weekly"
        ? weeklyRangeValidationError(draftTimeRanges.weekly, t)
        : reportType === "monthly"
          ? monthlyRangeValidationError(draftTimeRanges.monthly, t)
          : null;
    return [maxTokensError, rangeError].filter((message): message is string => message !== null);
  });

  function saveAdvancedSettings() {
    if (validationErrors.length > 0) {
      return;
    }
    setPayload((current) => {
      const nextMaxTokens = { ...defaultReportMaxTokens, ...(current.max_tokens ?? {}) };
      const nextTimeRanges = { ...(current.time_ranges ?? {}) };
      for (const reportType of enabledReportTypes) {
        const parsed = Number.parseInt(draftMaxTokens[reportType] ?? "", 10);
        nextMaxTokens[reportType] = parsed;
        if (reportType === "weekly" || reportType === "monthly") {
          nextTimeRanges[reportType] = normalizedTimeRange(reportType, draftTimeRanges[reportType]);
        } else {
          delete nextTimeRanges[reportType];
        }
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
    <Modal closeLabel={t("password.close")} isOpen={isOpen} onClose={onClose} title={t("reports.advancedSettingsTitle")}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {enabledReportTypes.length === 0 ? (
          <p className="rounded-lg bg-sigma-elevated p-3 text-sm text-sigma-muted">
            {t("reports.noAdvancedReports")}
          </p>
        ) : null}
        {enabledReportTypes.map((reportType) => {
          const label = t(`reports.${reportType}`);
          const maxTokensError = maxTokensValidationError(draftMaxTokens[reportType], t);
          return (
            <div className="space-y-3 rounded-lg bg-sigma-elevated p-3" key={reportType}>
              <h3 className="text-sm font-semibold text-sigma-text">{label}</h3>
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
              <TimeRangeFields
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
  range,
  reportType,
  setRange
}: {
  range?: ReportTimeRange;
  reportType: ReportType;
  setRange: (range: Partial<ReportTimeRange>) => void;
}) {
  const t = useTranslations("settings");

  if (reportType === "daily_morning") {
    return <ReadOnlyTimeRange label={t("reports.timeRange")} value={t("reports.dailyMorningRange")} />;
  }
  if (reportType === "daily_afternoon") {
    return <ReadOnlyTimeRange label={t("reports.timeRange")} value={t("reports.dailyAfternoonRange")} />;
  }
  if (reportType === "weekly") {
    const resolved = { ...defaultReportTimeRanges.weekly, ...(range ?? {}) };
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            error={weeklyRangeValidationError(resolved, t) ?? undefined}
            inputMode="numeric"
            label={t("reports.periodStartDays")}
            labelMode="stacked"
            min={0}
            max={14}
            onChange={(event) => setRange({ start_day_offset: parseIntegerInput(event.target.value) })}
            type="number"
            value={resolved.start_day_offset ?? ""}
          />
          <Input
            label={t("reports.periodStartTime")}
            labelMode="stacked"
            onChange={(event) => setRange({ start_time: event.target.value })}
            type="time"
            value={resolved.start_time ?? ""}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            inputMode="numeric"
            label={t("reports.periodEndDays")}
            labelMode="stacked"
            min={0}
            max={14}
            onChange={(event) => setRange({ end_day_offset: parseIntegerInput(event.target.value) })}
            type="number"
            value={resolved.end_day_offset ?? ""}
          />
          <Input
            label={t("reports.periodEndTime")}
            labelMode="stacked"
            onChange={(event) => setRange({ end_time: event.target.value })}
            type="time"
            value={resolved.end_time ?? ""}
          />
        </div>
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
          label={t("reports.periodStartDay")}
          labelMode="stacked"
          min={1}
          max={28}
          onChange={(event) => setRange({ start_day_of_month: parseIntegerInput(event.target.value) })}
          type="number"
          value={resolved.start_day_of_month ?? ""}
        />
        <Input
          inputMode="numeric"
          label={t("reports.periodEndDay")}
          labelMode="stacked"
          min={1}
          max={28}
          onChange={(event) => setRange({ end_day_of_month: parseIntegerInput(event.target.value) })}
          type="number"
          value={resolved.end_day_of_month ?? ""}
        />
      </div>
    );
  }
  return null;
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
  label,
  onChange,
  options,
  values
}: {
  compact?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  values: T[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
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
  const withoutDaily = current.filter((entry) => entry !== "daily");
  const next = withoutDaily.includes(value)
    ? withoutDaily.filter((entry) => entry !== value)
    : [...withoutDaily, value];
  return normalizeReportFrequencySelection(next.length > 0 ? next : [value]);
}

function normalizeReportFrequencySelection(values: ReportType[]): ReportType[] {
  const unique = Array.from(new Set(values));
  if (unique.includes("daily")) {
    return unique.filter((value) => value !== "daily_morning" && value !== "daily_afternoon");
  }
  return reportTypes.filter((value) => unique.includes(value));
}

function enabledReportTokenTypes(values: ReportType[]): ReportType[] {
  const tokenTypes = new Set<ReportType>();
  if (values.includes("daily")) {
    tokenTypes.add("daily_morning");
    tokenTypes.add("daily_afternoon");
  }
  for (const value of values) {
    if (tokenLimitReportTypes.includes(value)) {
      tokenTypes.add(value);
    }
  }
  return tokenLimitReportTypes.filter((value) => tokenTypes.has(value));
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
    startDay > 28 ||
    endDay < 1 ||
    endDay > 28
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
