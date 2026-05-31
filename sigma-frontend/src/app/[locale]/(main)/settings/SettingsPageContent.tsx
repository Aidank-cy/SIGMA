"use client";

import { Save } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { AdminSettingsSection } from "@/components/admin/AdminSettingsSection";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ReportConfigEditor, defaultReportConfig, normalizeReportConfig, reportConfigsEqual } from "@/components/settings/ReportConfigEditor";
import { useLLMSettings } from "@/hooks/useLLMSettings";
import { useReportConfig, useSettingsMutations } from "@/hooks/useSettings";
import { cn } from "@/lib/cn";
import type { Locale, UserReportConfig } from "@/lib/types";

import { PasswordResetModal } from "./SettingsPasswordResetModal";
import { LLMConfigSection, PasswordSection, ProfileSection, RetentionSection } from "./SettingsSections";

export function SettingsPageContent() {
  const state = useSettingsPageState();
  return <SettingsPageView {...state} />;
}

function useSettingsPageState() {
  const t = useTranslations("settings");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: reportConfig } = useReportConfig();
  const llmSettings = useLLMSettings();
  const { updateProfile, updateReportConfig, updateRetention } = useSettingsMutations();
  const [displayName, setDisplayName] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
  const [retentionDays, setRetentionDays] = useState(30);
  const initialReportConfig = reportConfig ?? defaultReportConfig;
  const [reportPayload, setReportPayload] = useState<UserReportConfig>(() => initialReportConfig);
  const [profileBaseline, setProfileBaseline] = useState({ displayName: "", locale });
  const [retentionBaseline, setRetentionBaseline] = useState(30);
  const [reportBaseline, setReportBaseline] = useState<UserReportConfig>(() => initialReportConfig);
  const reportBaselineRef = useRef<UserReportConfig>(initialReportConfig);
  const reportPayloadRef = useRef<UserReportConfig>(initialReportConfig);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const setSyncedReportPayload = useCallback((value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => {
    setReportPayload((current) => {
      const next = typeof value === "function" ? value(current) : value;
      reportPayloadRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const nextLocale = user.locale ?? locale;
    setDisplayName(user.display_name);
    setSelectedLocale(nextLocale);
    setRetentionDays(user.data_retention_days);
    setProfileBaseline({ displayName: user.display_name, locale: nextLocale });
    setRetentionBaseline(user.data_retention_days);
  }, [locale, user]);

  useEffect(() => {
    if (!reportConfig) return;
    const normalized = normalizeReportConfig(reportConfig);
    if (reportConfigsEqual(normalized, reportBaselineRef.current) || reportConfigsEqual(normalized, reportPayloadRef.current)) return;
    reportBaselineRef.current = normalized;
    setReportBaseline(normalized);
    reportPayloadRef.current = normalized;
    setReportPayload(normalized);
  }, [reportConfig]);

  const dirty = useMemo(() => ({
    language: selectedLocale !== profileBaseline.locale,
    profile: displayName !== profileBaseline.displayName,
    reports: !reportConfigsEqual(reportPayload, reportBaseline),
    retention: retentionDays !== retentionBaseline
  }), [displayName, profileBaseline, reportBaseline, reportPayload, retentionBaseline, retentionDays, selectedLocale]);
  const hasChanges = Object.values(dirty).some(Boolean);

  async function handleSaveAll() {
    if (!hasChanges || user === null) return;
    const jobs: Array<{ label: string; run: () => Promise<void> }> = [];
    if (dirty.profile || dirty.language) jobs.push({ label: dirty.profile ? t("profile.title") : t("profile.language"), run: async () => { await updateProfile.mutateAsync({ display_name: displayName, locale: selectedLocale }); setProfileBaseline({ displayName, locale: selectedLocale }); if (selectedLocale !== locale) router.replace(pathname.replace(/^\/(zh|en)/, `/${selectedLocale}`)); } });
    if (dirty.retention) jobs.push({ label: t("retention.title"), run: async () => { await updateRetention.mutateAsync({ data_retention_days: retentionDays }); setRetentionBaseline(retentionDays); } });
    if (dirty.reports) jobs.push({ label: t("reports.title"), run: async () => { const saved = await updateReportConfig.mutateAsync(reportPayload); const normalized = normalizeReportConfig(saved); reportBaselineRef.current = normalized; reportPayloadRef.current = normalized; setReportPayload(normalized); setReportBaseline(normalized); } });
    setIsSaving(true);
    const results = await Promise.allSettled(jobs.map((job) => job.run()));
    setIsSaving(false);
    const failed = results.map((result, index) => (result.status === "rejected" ? jobs[index].label : null)).filter((label): label is string => label !== null);
    if (failed.length > 0) {
      showToast(t("saveError", { sections: failed.join(", ") }), "error");
      return;
    }
    showToast(t("saved"), "success");
  }

  return { displayName, handleSaveAll, hasChanges, isPasswordOpen, isSaving, llmSettings, reportPayload, selectedLocale, setDisplayName, setIsPasswordOpen, setRetentionDays, setSelectedLocale, setSyncedReportPayload, retentionDays, user };
}

function SettingsPageView({
  displayName,
  handleSaveAll,
  hasChanges,
  isPasswordOpen,
  isSaving,
  llmSettings,
  reportPayload,
  retentionDays,
  selectedLocale,
  setDisplayName,
  setIsPasswordOpen,
  setRetentionDays,
  setSelectedLocale,
  setSyncedReportPayload,
  user
}: ReturnType<typeof useSettingsPageState>) {
  const t = useTranslations("settings");
  return (
    <section className="flex flex-col gap-6 p-6 lg:p-8">
      <header className="border-b border-border pb-6"><p className="text-[13px] font-bold uppercase text-primary">{t("eyebrow")}</p><h1 className="mt-2 text-[32px] font-bold text-foreground">{t("title")}</h1><p className="mt-2 text-sm text-foreground/60">{t("subtitle")}</p></header>
      <div className="grid items-stretch gap-5 xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex w-full flex-col gap-5 xl:w-[34rem] xl:max-w-[34rem]">
          {user ? <ProfileSection displayName={displayName} locale={selectedLocale} onDisplayNameChange={setDisplayName} onLocaleChange={setSelectedLocale} /> : <Skeleton className="h-60 rounded-2xl" />}
          {user ? <RetentionSection days={retentionDays} onChange={setRetentionDays} /> : <Skeleton className="h-44 rounded-2xl" />}
          <ReportConfigEditor payload={reportPayload} setPayload={setSyncedReportPayload} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <div className={cn(!reportPayload.is_active && "pointer-events-none select-none opacity-40")}>
            <LLMConfigSection configData={llmSettings.config.data} isConfigLoading={llmSettings.config.isLoading} isSaving={llmSettings.update.isPending} onConfigRefetch={llmSettings.config.refetch} onSave={llmSettings.update.mutateAsync} usageData={llmSettings.usage.data} />
          </div>
          <div className="flex items-stretch gap-3">
            <PasswordSection onOpen={() => setIsPasswordOpen(true)} className="flex-1" />
            <Button className="shrink-0 self-center" disabled={!hasChanges || user === null} isLoading={isSaving} onClick={handleSaveAll}><Save className="h-4 w-4" aria-hidden />{t("save")}</Button>
          </div>
        </div>
      </div>
      {user?.role === "admin" ? <AdminSettingsSection /> : null}
      {user ? <PasswordResetModal email={user.email} isOpen={isPasswordOpen} onClose={() => setIsPasswordOpen(false)} /> : null}
    </section>
  );
}
