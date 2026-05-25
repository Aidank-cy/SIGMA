"use client";

import { KeyRound, Save } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { AdminSettingsSection } from "@/components/admin/AdminSettingsSection";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import {
  ReportConfigEditor,
  defaultReportConfig,
  normalizeReportConfig,
  reportConfigsEqual
} from "@/components/settings/ReportConfigEditor";
import { useLLMSettings } from "@/hooks/useLLMSettings";
import { useReportConfig, useSettingsMutations } from "@/hooks/useSettings";
import type { User } from "@/lib/auth";
import { cn } from "@/lib/cn";
import type { LLMConfig, LLMUsageResponse, Locale, UserReportConfig } from "@/lib/types";

const retentionOptions = [7, 30, 60, 90] as const;

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: reportConfig, isLoading } = useReportConfig();
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
  const setSyncedReportPayload = useCallback(
    (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => {
      setReportPayload((current) => {
        const next = typeof value === "function" ? value(current) : value;
        reportPayloadRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    const nextLocale = user.locale ?? locale;
    setDisplayName(user.display_name);
    setSelectedLocale(nextLocale);
    setRetentionDays(user.data_retention_days);
    setProfileBaseline({ displayName: user.display_name, locale: nextLocale });
    setRetentionBaseline(user.data_retention_days);
  }, [locale, user]);

  useEffect(() => {
    if (!reportConfig) {
      return;
    }
    const normalized = normalizeReportConfig(reportConfig);
    if (
      reportConfigsEqual(normalized, reportBaselineRef.current) ||
      reportConfigsEqual(normalized, reportPayloadRef.current)
    ) {
      return;
    }
    reportBaselineRef.current = normalized;
    setReportBaseline(normalized);
    reportPayloadRef.current = normalized;
    setReportPayload(normalized);
  }, [reportConfig]);

  const dirty = useMemo(
    () => ({
      language: selectedLocale !== profileBaseline.locale,
      profile: displayName !== profileBaseline.displayName,
      reports: !reportConfigsEqual(reportPayload, reportBaseline),
      retention: retentionDays !== retentionBaseline
    }),
    [displayName, profileBaseline, reportBaseline, reportPayload, retentionBaseline, retentionDays, selectedLocale]
  );
  const hasChanges = Object.values(dirty).some(Boolean);

  async function handleSaveAll() {
    if (!hasChanges || user === null) {
      return;
    }

    const jobs: Array<{ label: string; run: () => Promise<void> }> = [];
    if (dirty.profile || dirty.language) {
      jobs.push({
        label: dirty.profile ? t("profile.title") : t("profile.language"),
        run: async () => {
          await updateProfile.mutateAsync({ display_name: displayName, locale: selectedLocale });
          setProfileBaseline({ displayName, locale: selectedLocale });
          // Redirect to new locale if language changed.
          if (selectedLocale !== locale) {
            const newPath = pathname.replace(/^\/(zh|en)/, `/${selectedLocale}`);
            router.replace(newPath);
            return;
          }
        }
      });
    }
    if (dirty.retention) {
      jobs.push({
        label: t("retention.title"),
        run: async () => {
          await updateRetention.mutateAsync({ data_retention_days: retentionDays });
          setRetentionBaseline(retentionDays);
        }
      });
    }
    if (dirty.reports) {
      jobs.push({
        label: t("reports.title"),
        run: async () => {
          const saved = await updateReportConfig.mutateAsync(reportPayload);
          const normalized = normalizeReportConfig(saved);
          reportBaselineRef.current = normalized;
          reportPayloadRef.current = normalized;
          setReportPayload(normalized);
          setReportBaseline(normalized);
        }
      });
    }
    setIsSaving(true);
    const results = await Promise.allSettled(jobs.map((job) => job.run()));
    setIsSaving(false);
    const failed = results
      .map((result, index) => (result.status === "rejected" ? jobs[index].label : null))
      .filter((label): label is string => label !== null);

    if (failed.length > 0) {
      showToast(t("saveError", { sections: failed.join(", ") }), "error");
      return;
    }
    showToast(t("saved"), "success");
  }

  return (
    <section className="flex flex-col gap-6 p-6 lg:p-8">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-medium uppercase text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-foreground/60">{t("subtitle")}</p>
      </header>

      <div className="grid items-stretch gap-5 xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex w-full flex-col gap-5 xl:w-[34rem] xl:max-w-[34rem]">
          {user ? (
            <ProfileSection
              displayName={displayName}
              locale={selectedLocale}
              onDisplayNameChange={setDisplayName}
              onLocaleChange={setSelectedLocale}
            />
          ) : (
            <Skeleton className="h-60 rounded-2xl" />
          )}
          {user ? (
            <RetentionSection days={retentionDays} onChange={setRetentionDays} />
          ) : (
            <Skeleton className="h-44 rounded-2xl" />
          )}
          {isLoading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (
            <ReportConfigEditor payload={reportPayload} setPayload={setSyncedReportPayload} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <div className={cn(!reportPayload.is_active && "pointer-events-none select-none opacity-40")}>
            <LLMConfigSection
              configData={llmSettings.config.data}
              isConfigLoading={llmSettings.config.isLoading}
              isSaving={llmSettings.update.isPending}
              onSave={llmSettings.update.mutateAsync}
              usageData={llmSettings.usage.data}
            />
          </div>
          <div className="flex items-stretch gap-3">
            <PasswordSection onOpen={() => setIsPasswordOpen(true)} className="flex-1" />
            <Button
              className="shrink-0 self-center"
              disabled={!hasChanges || user === null}
              isLoading={isSaving}
              onClick={handleSaveAll}
            >
              <Save className="h-4 w-4" aria-hidden />
              {t("save")}
            </Button>
          </div>
        </div>
      </div>

      {user?.role === "admin" ? <AdminSettingsSection /> : null}

      {user ? (
        <PasswordResetModal
          email={user.email}
          isOpen={isPasswordOpen}
          onClose={() => setIsPasswordOpen(false)}
        />
      ) : null}
    </section>
  );
}

function LLMConfigSection({
  configData,
  isConfigLoading,
  isSaving,
  onSave,
  usageData
}: {
  configData?: LLMConfig;
  isConfigLoading: boolean;
  isSaving: boolean;
  onSave: (form: LLMConfig) => Promise<unknown>;
  usageData?: LLMUsageResponse;
}) {
  const t = useTranslations("settings.llm");

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("caption")}</p>
      </div>
      <LLMSettingsPanel
        configData={configData}
        isConfigLoading={isConfigLoading}
        isSaving={isSaving}
        onSave={onSave}
        usageData={usageData}
      />
    </div>
  );
}

function ProfileSection({
  displayName,
  locale,
  onDisplayNameChange,
  onLocaleChange
}: {
  displayName: string;
  locale: Locale;
  onDisplayNameChange: (value: string) => void;
  onLocaleChange: (value: Locale) => void;
}) {
  const t = useTranslations("settings");

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">{t("profile.title")}</h2>
        <Input
          className="text-muted-foreground opacity-65 focus:text-foreground focus:opacity-100"
          labelMode="stacked"
          label={t("profile.displayName")}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          value={displayName}
        />
        <CustomSelect
          labelMode="stacked"
          label={t("profile.language")}
          onChange={(value) => onLocaleChange(value as Locale)}
          options={[
            { label: t("profile.zh"), value: "zh" },
            { label: t("profile.en"), value: "en" }
          ]}
          value={locale}
        />
      </div>
    </Card>
  );
}

function RetentionSection({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  const t = useTranslations("settings");

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">{t("retention.title")}</h2>
        <div className="overflow-x-auto pb-1 pt-1">
          <SegmentControl
            activeId={String(days)}
            items={retentionOptions.map((option) => ({ id: String(option), label: t("retention.days", { count: option }) }))}
            onChange={(value) => onChange(Number(value))}
          />
        </div>
      </div>
    </Card>
  );
}

function PasswordSection({
  className,
  onOpen,
}: {
  className?: string;
  onOpen: () => void;
}) {
  const t = useTranslations("settings");

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{t("password.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("password.caption")}</p>
        </div>
        <Button className="shrink-0" onClick={onOpen} variant="secondary">
          <KeyRound className="h-4 w-4" aria-hidden />
          {t("password.open")}
        </Button>
      </div>
    </Card>
  );
}

function PasswordResetModal({ email, isOpen, onClose }: { email: string; isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { requestPasswordReset, resetPassword, verifyResetCode } = useSettingsMutations();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setCode("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback(null);
    }
  }, [isOpen]);

  async function sendCode() {
    try {
      await requestPasswordReset.mutateAsync({ email });
      setFeedback({ message: t("password.codeSent"), type: "success" });
      setStep(2);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t("password.error"), type: "error" });
    }
  }

  async function verifyCode() {
    try {
      const response = await verifyResetCode.mutateAsync({ code, email });
      setResetToken(response.reset_token);
      setFeedback({ message: t("password.codeVerified"), type: "success" });
      setStep(3);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t("password.invalidCode"), type: "error" });
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setFeedback({ message: t("password.mismatch"), type: "error" });
      return;
    }
    try {
      await resetPassword.mutateAsync({ new_password: newPassword, reset_token: resetToken });
      showToast(t("password.updated"), "success");
      onClose();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t("password.error"), type: "error" });
    }
  }

  return (
    <Modal closeLabel={t("password.close")} isOpen={isOpen} onClose={onClose} title={t("password.title")}>
      <div className="space-y-5">
        <SegmentControl
          activeId={String(step)}
          items={[
            { id: "1", label: t("password.steps.send") },
            { id: "2", label: t("password.steps.verify") },
            { id: "3", label: t("password.steps.reset") }
          ]}
          onChange={() => undefined}
        />
        <p className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">{t("password.devHint")}</p>
        {feedback ? (
          <p className={feedback.type === "success" ? "text-sm font-medium text-chart-1" : "text-sm font-medium text-destructive"}>
            {feedback.message}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <Input label={t("password.email")} labelMode="stacked" readOnly value={email} />
            <Button isLoading={requestPasswordReset.isPending} onClick={sendCode}>
              {t("password.sendCode")}
            </Button>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="space-y-4">
            <Input
              inputMode="numeric"
              label={t("password.code")}
              labelMode="stacked"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              value={code}
            />
            <Button disabled={code.length !== 6} isLoading={verifyResetCode.isPending} onClick={verifyCode}>
              {t("password.verify")}
            </Button>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-4">
            <Input
              label={t("password.next")}
              labelMode="stacked"
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
            <Input
              label={t("password.confirm")}
              labelMode="stacked"
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
            <Button
              disabled={newPassword.length === 0 || confirmPassword.length === 0}
              isLoading={resetPassword.isPending}
              onClick={savePassword}
            >
              {t("password.save")}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
