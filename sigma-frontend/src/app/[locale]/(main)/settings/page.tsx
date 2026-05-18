"use client";

import { Clock3, KeyRound, Save } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { AdminSettingsSection } from "@/components/admin/AdminSettingsSection";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useToast } from "@/components/ui/Toast";
import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import { useLLMSettings } from "@/hooks/useLLMSettings";
import { useReportConfig, useSettingsMutations } from "@/hooks/useSettings";
import { useLastCollectionStats } from "@/hooks/useStats";
import { useTheme } from "@/hooks/useTheme";
import type { Category, LLMConfig, LLMUsageResponse, Locale, Market, ReportType, UserReportConfig } from "@/lib/types";

const retentionOptions = [7, 30, 60, 90, 180, 365] as const;
const categories: Category[] = ["politics", "finance", "technology", "macro"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "global"];
const reportTypes: ReportType[] = ["daily", "weekly", "monthly"];

const defaultReportConfig: UserReportConfig = {
  categories: [],
  is_active: true,
  markets: [],
  report_frequency: "daily"
};

const TrendLine = dynamic(() => import("@/components/charts/TrendLine").then((module) => module.TrendLine), {
  loading: () => <Skeleton className="h-56 w-full" />,
  ssr: false
});

export default function SettingsPage() {
  const t = useTranslations("settings");
  const defaultLocale = useLocale() as Locale;
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: reportConfig, isLoading } = useReportConfig();
  const lastCollection = useLastCollectionStats();
  const llmSettings = useLLMSettings();
  const { updateProfile, updateReportConfig, updateRetention } = useSettingsMutations();
  const { isDark } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<Locale>(defaultLocale);
  const [retentionDays, setRetentionDays] = useState(30);
  const [reportPayload, setReportPayload] = useState<UserReportConfig>(defaultReportConfig);
  const [profileBaseline, setProfileBaseline] = useState({ displayName: "", locale: defaultLocale });
  const [retentionBaseline, setRetentionBaseline] = useState(30);
  const [reportBaseline, setReportBaseline] = useState<UserReportConfig>(defaultReportConfig);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    const nextLocale = user.locale ?? defaultLocale;
    setDisplayName(user.display_name);
    setSelectedLocale(nextLocale);
    setRetentionDays(user.data_retention_days);
    setProfileBaseline({ displayName: user.display_name, locale: nextLocale });
    setRetentionBaseline(user.data_retention_days);
  }, [defaultLocale, user]);

  useEffect(() => {
    if (!reportConfig) {
      return;
    }
    setReportPayload(reportConfig);
    setReportBaseline(reportConfig);
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
          setReportPayload(saved);
          setReportBaseline(saved);
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
    <section className="flex flex-col gap-6 pb-24">
      <header className="border-b border-sigma-line pb-6">
        <p className="text-sm font-medium uppercase text-sigma-accent">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-sigma-text sm:text-4xl">{t("title")}</h1>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
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
            <ReportConfigSection payload={reportPayload} setPayload={setReportPayload} />
          )}
          <LLMConfigSection
            configData={llmSettings.config.data}
            isConfigLoading={llmSettings.config.isLoading}
            isSaving={llmSettings.update.isPending}
            onSave={llmSettings.update.mutateAsync}
            usageData={llmSettings.usage.data}
          />
          <PasswordSection onOpen={() => setIsPasswordOpen(true)} />
        </div>
        <div className="flex flex-col gap-5">
          <ThemeSection isDark={isDark} />
          <DataFreshnessCard
            isLoading={lastCollection.isLoading}
            lastSuccess={lastCollection.data?.last_success ?? null}
          />
          <Card className="p-5">
            <h2 className="text-base font-semibold text-sigma-text">{t("trend.title")}</h2>
            <p className="mt-1 text-sm text-sigma-muted">{t("trend.caption")}</p>
            <div className="mt-5">
              <TrendLine
                data={[
                  { label: t("trend.day", { count: 6 }), value: 9 },
                  { label: t("trend.day", { count: 5 }), value: 12 },
                  { label: t("trend.day", { count: 4 }), value: 10 },
                  { label: t("trend.day", { count: 3 }), value: 18 },
                  { label: t("trend.day", { count: 2 }), value: 16 },
                  { label: t("trend.day", { count: 1 }), value: 23 },
                  { label: t("trend.today"), value: 21 }
                ]}
              />
            </div>
          </Card>
        </div>
      </div>

      {user?.role === "admin" ? <AdminSettingsSection /> : null}

      <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-6xl rounded-full border border-sigma-line bg-sigma-elevated/95 p-2 shadow-apple backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 px-3 text-sm font-medium text-sigma-muted">
            {hasChanges ? t("unsaved") : t("noChanges")}
          </p>
          <Button disabled={!hasChanges || user === null} isLoading={isSaving} onClick={handleSaveAll}>
            <Save className="h-4 w-4" aria-hidden />
            {t("save")}
          </Button>
        </div>
      </div>

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
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-sigma-text">{t("title")}</h2>
        <p className="mt-1 text-sm text-sigma-muted">{t("caption")}</p>
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
        <h2 className="text-base font-semibold text-sigma-text">{t("profile.title")}</h2>
        <Input label={t("profile.displayName")} onChange={(event) => onDisplayNameChange(event.target.value)} value={displayName} />
        <Select
          label={t("profile.language")}
          onChange={(event) => onLocaleChange(event.target.value as Locale)}
          value={locale}
        >
          <option value="zh">{t("profile.zh")}</option>
          <option value="en">{t("profile.en")}</option>
        </Select>
      </div>
    </Card>
  );
}

function RetentionSection({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  const t = useTranslations("settings");

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-sigma-text">{t("retention.title")}</h2>
        <div className="overflow-x-auto pb-1">
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

function ReportConfigSection({
  payload,
  setPayload
}: {
  payload: UserReportConfig;
  setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void;
}) {
  const t = useTranslations("settings");

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5">
        <h2 className="text-base font-semibold text-sigma-text">{t("reports.title")}</h2>
        <div className="overflow-x-auto pb-1">
          <SegmentControl
            activeId={payload.report_frequency}
            items={reportTypes.map((value) => ({ id: value, label: t(`reports.${value}`) }))}
            onChange={(value) => setPayload((current) => ({ ...current, report_frequency: value as ReportType }))}
          />
        </div>
        <ToggleSet
          label={t("reports.markets")}
          onToggle={(value) =>
            setPayload((current) => ({
              ...current,
              markets: current.markets.includes(value as Market)
                ? current.markets.filter((item) => item !== value)
                : [...current.markets, value as Market]
            }))
          }
          options={markets.map((value) => ({ label: t(`markets.${value}`), value }))}
          values={payload.markets}
        />
        <ToggleSet
          label={t("reports.categories")}
          onToggle={(value) =>
            setPayload((current) => ({
              ...current,
              categories: current.categories.includes(value as Category)
                ? current.categories.filter((item) => item !== value)
                : [...current.categories, value as Category]
            }))
          }
          options={categories.map((value) => ({ label: t(`categories.${value}`), value }))}
          values={payload.categories}
        />
        <div className="flex items-center gap-3 text-sm font-medium text-sigma-text">
          <ToggleSwitch
            checked={payload.is_active}
            label={t("reports.active")}
            onChange={(checked) => setPayload((current) => ({ ...current, is_active: checked }))}
          />
          {t("reports.active")}
        </div>
      </div>
    </Card>
  );
}

function ThemeSection({ isDark }: { isDark: boolean }) {
  const t = useTranslations("settings");

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-sigma-text">{t("theme.title")}</h2>
          <p className="mt-1 text-sm text-sigma-muted">{t("theme.caption")}</p>
        </div>
        <span className="rounded-full bg-sigma-elevated px-3 py-1 text-sm font-medium text-sigma-text">
          {isDark ? t("theme.dark") : t("theme.light")}
        </span>
      </div>
    </Card>
  );
}

function DataFreshnessCard({ isLoading, lastSuccess }: { isLoading: boolean; lastSuccess: string | null }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("settings");
  const formatted = useMemo(() => {
    if (!lastSuccess) {
      return t("noCollection");
    }
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(lastSuccess));
  }, [lastSuccess, locale, t]);

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-sigma-accent/10 p-2 text-sigma-accent">
          <Clock3 className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-sigma-text">{t("dataFreshness")}</h2>
          <p className="mt-1 text-sm text-sigma-muted">{t("lastUpdated")}</p>
          {isLoading ? (
            <Skeleton className="mt-4 h-5 w-40" />
          ) : (
            <p className="mt-4 text-sm font-medium text-sigma-text">{formatted}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function PasswordSection({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("settings");

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-sigma-text">{t("password.title")}</h2>
          <p className="mt-1 text-sm text-sigma-muted">{t("password.caption")}</p>
        </div>
        <Button onClick={onOpen} variant="secondary">
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
        <p className="rounded-2xl bg-sigma-surface px-4 py-3 text-sm text-sigma-muted">{t("password.devHint")}</p>
        {feedback ? (
          <p className={feedback.type === "success" ? "text-sm font-medium text-sigma-success" : "text-sm font-medium text-sigma-danger"}>
            {feedback.message}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <Input label={t("password.email")} readOnly value={email} />
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
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
            <Input
              label={t("password.confirm")}
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

interface Option {
  label: string;
  value: string;
}

function ToggleSet({
  label,
  onToggle,
  options,
  values
}: {
  label: string;
  onToggle: (value: string) => void;
  options: Option[];
  values: string[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-sigma-text">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            className={
              values.includes(option.value)
                ? "rounded-full bg-sigma-text px-3 py-2 text-sm font-medium text-sigma-bg"
                : "rounded-full border border-sigma-line px-3 py-2 text-sm font-medium text-sigma-muted hover:text-sigma-text"
            }
            key={option.value}
            onClick={() => onToggle(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function reportConfigsEqual(left: UserReportConfig, right: UserReportConfig) {
  return (
    left.is_active === right.is_active &&
    left.report_frequency === right.report_frequency &&
    stringArraysEqual(left.categories, right.categories) &&
    stringArraysEqual(left.markets, right.markets)
  );
}

function stringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}
