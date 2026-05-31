"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import { cn } from "@/lib/cn";
import type { LLMConfig, LLMUsageResponse, Locale } from "@/lib/types";

const retentionOptions = [7, 30, 60, 90] as const;

export function LLMConfigSection({
  configData,
  isConfigLoading,
  isSaving,
  onConfigRefetch,
  onSave,
  usageData
}: {
  configData?: LLMConfig;
  isConfigLoading: boolean;
  isSaving: boolean;
  onConfigRefetch: () => Promise<unknown> | unknown;
  onSave: (form: LLMConfig) => Promise<unknown>;
  usageData?: LLMUsageResponse;
}) {
  const t = useTranslations("settings.llm");
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div><h2 className="text-[20px] font-bold text-foreground">{t("title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("caption")}</p></div>
      <LLMSettingsPanel configData={configData} isConfigLoading={isConfigLoading} isSaving={isSaving} onConfigRefetch={onConfigRefetch} onSave={onSave} usageData={usageData} />
    </div>
  );
}

export function ProfileSection({ displayName, locale, onDisplayNameChange, onLocaleChange }: { displayName: string; locale: Locale; onDisplayNameChange: (value: string) => void; onLocaleChange: (value: Locale) => void }) {
  const t = useTranslations("settings");
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-[20px] font-bold text-foreground">{t("profile.title")}</h2>
        <Input className="text-muted-foreground opacity-65 focus:text-foreground focus:opacity-100" labelMode="stacked" label={t("profile.displayName")} onChange={(event) => onDisplayNameChange(event.target.value)} value={displayName} />
        <CustomSelect labelMode="stacked" label={t("profile.language")} onChange={(value) => onLocaleChange(value as Locale)} options={[{ label: t("profile.zh"), value: "zh" }, { label: t("profile.en"), value: "en" }]} value={locale} />
      </div>
    </Card>
  );
}

export function RetentionSection({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  const t = useTranslations("settings");
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-[20px] font-bold text-foreground">{t("retention.title")}</h2>
        <div className="overflow-x-auto pb-1 pt-1">
          <SegmentControl activeId={String(days)} items={retentionOptions.map((option) => ({ id: String(option), label: t("retention.days", { count: option }) }))} onChange={(value) => onChange(Number(value))} />
        </div>
      </div>
    </Card>
  );
}

export function PasswordSection({ className, onOpen }: { className?: string; onOpen: () => void }) {
  const t = useTranslations("settings");
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><h2 className="text-[20px] font-bold text-foreground">{t("password.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("password.caption")}</p></div>
        <Button className="shrink-0" onClick={onOpen} variant="secondary"><KeyRound className="h-4 w-4" aria-hidden />{t("password.open")}</Button>
      </div>
    </Card>
  );
}
