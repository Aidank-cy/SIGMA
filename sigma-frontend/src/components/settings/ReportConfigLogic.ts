import type { useTranslations } from "next-intl";

import type { Category, Market, ReportTimeRange, ReportType, UserReportConfig } from "@/lib/types";

export const categories: Category[] = ["politics", "finance", "technology", "macro"];
export const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw"];
export const reportTypes: ReportType[] = ["daily", "daily_morning", "daily_afternoon", "weekly", "monthly"];
export const tokenLimitReportTypes: ReportType[] = ["daily_morning", "daily_afternoon", "weekly", "monthly"];

export const defaultReportMaxTokens: Partial<Record<ReportType, number>> = {
  daily_morning: 2000,
  daily_afternoon: 2000,
  weekly: 3000,
  monthly: 4000
};

export const defaultReportTimeRanges: Partial<Record<ReportType, ReportTimeRange>> = {
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

export type SettingsTranslator = ReturnType<typeof useTranslations>;

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

export function reportFrequencies(config: UserReportConfig): ReportType[] {
  const frequencies = config.report_frequencies ?? (config.report_frequency ? [config.report_frequency] : []);
  return frequencies.length > 0 ? normalizeReportFrequencySelection(frequencies) : ["daily"];
}

export function toggleReportFrequency(current: ReportType[], value: ReportType): ReportType[] {
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

export function reportTypeIsActive(reportType: ReportType, values: ReportType[]) {
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

function tokenLimitsEqual(left: Partial<Record<ReportType, number>>, right: Partial<Record<ReportType, number>>) {
  return tokenLimitReportTypes.every((reportType) => (left[reportType] ?? defaultReportMaxTokens[reportType]) === (right[reportType] ?? defaultReportMaxTokens[reportType]));
}

function timeRangesEqual(left: Partial<Record<ReportType, ReportTimeRange>>, right: Partial<Record<ReportType, ReportTimeRange>>) {
  return tokenLimitReportTypes.every((reportType) => reportTimeRangeEqual(left[reportType], right[reportType]));
}

function reportTimeRangeEqual(left?: ReportTimeRange, right?: ReportTimeRange) {
  const numberFields: Array<keyof ReportTimeRange> = ["start_day_offset", "end_day_offset", "generation_day_of_week", "generation_day_of_month", "start_day_of_month", "end_day_of_month"];
  const timeFields: Array<keyof ReportTimeRange> = ["start_time", "end_time", "generation_time"];
  return (
    numberFields.every((field) => (left?.[field] ?? null) === (right?.[field] ?? null)) &&
    timeFields.every((field) => (left?.[field] ?? "") === (right?.[field] ?? ""))
  );
}

export function normalizedTimeRange(reportType: ReportType, range?: ReportTimeRange): ReportTimeRange {
  return {
    ...(defaultReportTimeRanges[reportType] ?? {}),
    ...(range ?? {})
  };
}

export function stripUndefinedTimeRange(range: ReportTimeRange): ReportTimeRange {
  return Object.fromEntries(Object.entries(range).filter(([, value]) => value !== undefined && value !== null)) as ReportTimeRange;
}

export function maxTokensValidationError(value: string | undefined, t: SettingsTranslator) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 50000) {
    return t("reports.maxTokensError");
  }
  return null;
}

export function generationTimeValidationError(value: string | undefined, t: SettingsTranslator) {
  if (parseTimeToMinutes(value) === null) {
    return t("reports.generationTimeError");
  }
  return null;
}

export function weeklyRangeValidationError(range: ReportTimeRange | undefined, t: SettingsTranslator) {
  const resolved = { ...defaultReportTimeRanges.weekly, ...(range ?? {}) };
  const startOffset = resolved.start_day_offset;
  const endOffset = resolved.end_day_offset;
  const startMinutes = parseTimeToMinutes(resolved.start_time);
  const endMinutes = parseTimeToMinutes(resolved.end_time);
  if (startOffset === undefined || endOffset === undefined || startMinutes === null || endMinutes === null || startOffset < 0 || endOffset < 0 || startOffset > 14 || endOffset > 14) {
    return t("reports.weeklyRangeInvalid");
  }
  const spanMinutes = (startOffset - endOffset) * 24 * 60 + endMinutes - startMinutes;
  if (spanMinutes <= 0) return t("reports.weeklyRangeOrder");
  if (spanMinutes < 24 * 60) return t("reports.weeklyRangeTooShort");
  if (spanMinutes > 14 * 24 * 60) return t("reports.weeklyRangeTooLong");
  return null;
}

export function monthlyRangeValidationError(range: ReportTimeRange | undefined, t: SettingsTranslator) {
  const resolved = { ...defaultReportTimeRanges.monthly, ...(range ?? {}) };
  const startDay = resolved.start_day_of_month;
  const endDay = resolved.end_day_of_month;
  if (startDay === undefined || endDay === undefined || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
    return t("reports.monthlyRangeInvalid");
  }
  if (startDay > endDay) {
    return t("reports.monthlyRangeOrder");
  }
  return null;
}

export function parseIntegerInput(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseTimeToMinutes(value: string | undefined) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function weeklyPreview(range: ReportTimeRange, t: SettingsTranslator) {
  const startOffset = range.start_day_offset ?? 7;
  const endOffset = range.end_day_offset ?? 0;
  const startLabel = weeklyOffsetPreviewLabel(startOffset, endOffset, t);
  const endLabel = weeklyOffsetPreviewLabel(endOffset, startOffset, t);
  const spanDays = Math.round(((startOffset - endOffset) * 24 * 60 + (parseTimeToMinutes(range.end_time) ?? 0) - (parseTimeToMinutes(range.start_time) ?? 0)) / (24 * 60));
  return t("reports.weeklyPreview", { end: `${endLabel} ${range.end_time ?? "17:44"}`, span: Math.max(1, spanDays), start: `${startLabel} ${range.start_time ?? "17:45"}` });
}

function weeklyOffsetPreviewLabel(offset: number, pairedOffset: number, t: SettingsTranslator) {
  if (offset === 0) return pairedOffset >= 7 ? t("reports.nextFriday") : t("reports.reportFriday");
  if (offset === 7) return t("reports.friday");
  return t("reports.daysBeforeReportShort", { count: offset });
}

export function monthlyPreview(range: ReportTimeRange, t: SettingsTranslator) {
  return t("reports.monthlyPreview", { end: ordinalDay(range.end_day_of_month ?? 28, t), start: ordinalDay(range.start_day_of_month ?? 1, t) });
}

function ordinalDay(day: number, t: SettingsTranslator) {
  if (t("reports.ordinalLocale") === "zh") {
    return t("reports.dayOfMonth", { day });
  }
  const remainder = day % 100;
  const suffix = remainder >= 11 && remainder <= 13 ? "th" : ["th", "st", "nd", "rd"][day % 10] ?? "th";
  return `${day}${suffix}`;
}
