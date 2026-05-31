"use client";

import { SlidersHorizontal } from "lucide-react";
import { memo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { UserReportConfig } from "@/lib/types";

import {
  categories,
  markets,
  reportConfigsEqual,
  reportFrequencies,
  reportTypes,
  toggleReportFrequency
} from "./ReportConfigLogic";
import {
  ActiveReportToggle,
  FrequencyPills,
  MultiSelectPills,
  ReportAdvancedSettingsModal
} from "./ReportConfigSections";

export {
  defaultReportConfig,
  defaultReportMaxTokens,
  normalizeReportConfig,
  reportConfigsEqual
} from "./ReportConfigLogic";

interface ReportConfigEditorProps {
  className?: string;
  compact?: boolean;
  isSaving?: boolean;
  hideSaveButton?: boolean;
  onSave?: () => void;
  payload: UserReportConfig;
  saveLabel?: string;
  setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void;
  title?: string;
}

export const ReportConfigEditor = memo(function ReportConfigEditor({
  className,
  compact = false,
  hideSaveButton = false,
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
    <Button className={compact ? undefined : "ml-auto"} onClick={() => setIsAdvancedOpen(true)} size="sm" type="button" variant="ghost">
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      {t("reports.advancedSettings")}
    </Button>
  );

  return (
    <Card className={cn("p-6", className)}>
      <div className={cn("flex flex-col", compact ? "gap-6" : "gap-6")}>
        <ReportConfigHeader compact={compact} payload={payload} setPayload={setPayload} title={title ?? t("reports.title")} />
        <div className={cn("flex flex-col", compact ? "gap-6" : "gap-6")}>
          <div className={cn(disabledControlClass)}>
            <FrequencyPills compact={compact} label={t("reports.frequency")} onChange={(value) => setPayload((current) => {
              const nextFrequencies = toggleReportFrequency(reportFrequencies(current), value);
              return { ...current, report_frequency: nextFrequencies[0], report_frequencies: nextFrequencies };
            })} options={reportTypes.map((value) => ({ label: t(`reports.${value}`), value }))} values={activeReportFrequencies} extraContent={advancedSettingsButton} />
          </div>
          <div className={cn(disabledControlClass)}>
            <MultiSelectPills allLabel={t("reports.allMarkets")} compact={compact} label={t("reports.markets")} onChange={(values) => setPayload((current) => ({ ...current, markets: values }))} options={markets.map((value) => ({ label: t(`markets.${value}`), value }))} values={payload.markets} />
          </div>
          <div className={cn(disabledControlClass)}>
            <MultiSelectPills allLabel={t("reports.allCategories")} compact={compact} label={t("reports.categories")} onChange={(values) => setPayload((current) => ({ ...current, categories: values }))} options={categories.map((value) => ({ label: t(`categories.${value}`), value }))} values={payload.categories} />
          </div>
          {onSave && !hideSaveButton ? <Button className="w-full" isLoading={isSaving} onClick={onSave} type="button">{saveLabel ?? t("save")}</Button> : null}
        </div>
      </div>
      <ReportAdvancedSettingsModal activeReportFrequencies={activeReportFrequencies} isOpen={isAdvancedOpen} onClose={() => setIsAdvancedOpen(false)} payload={payload} setPayload={setPayload} />
    </Card>
  );
}, reportConfigEditorPropsEqual);

function ReportConfigHeader({
  compact,
  payload,
  setPayload,
  title
}: {
  compact: boolean;
  payload: UserReportConfig;
  setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void;
  title: string;
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <ActiveReportToggle payload={payload} setPayload={setPayload} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <ActiveReportToggle payload={payload} setPayload={setPayload} />
    </div>
  );
}

function reportConfigEditorPropsEqual(prev: ReportConfigEditorProps, next: ReportConfigEditorProps) {
  return (
    prev.className === next.className &&
    prev.compact === next.compact &&
    prev.hideSaveButton === next.hideSaveButton &&
    prev.isSaving === next.isSaving &&
    prev.onSave === next.onSave &&
    prev.saveLabel === next.saveLabel &&
    prev.setPayload === next.setPayload &&
    prev.title === next.title &&
    reportConfigsEqual(prev.payload, next.payload)
  );
}
