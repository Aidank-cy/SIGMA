"use client";

import { Clock3, KeyRound, Save } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { AdminSettingsSection } from "@/components/admin/AdminSettingsSection";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useToast } from "@/components/ui/Toast";
import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import { useItems } from "@/hooks/useItems";
import { useLLMSettings } from "@/hooks/useLLMSettings";
import { useReportConfig, useSettingsMutations } from "@/hooks/useSettings";
import { useLastCollectionStats } from "@/hooks/useStats";
import { toggleMultiSelection } from "@/lib/selection";
import type { Category, LLMConfig, LLMUsageResponse, Locale, Market, ReportType, UserReportConfig } from "@/lib/types";

const retentionOptions = [7, 30, 60, 90] as const;
const categories: Category[] = ["politics", "finance", "technology", "macro"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw"];
const reportTypes: ReportType[] = ["daily", "weekly", "monthly"];

const defaultReportConfig: UserReportConfig = {
  categories: [],
  is_active: true,
  markets: [],
  report_frequency: "daily",
  report_frequencies: []
};

const TrendLine = dynamic(() => import("@/components/charts/TrendLine").then((module) => module.TrendLine), {
  loading: () => <Skeleton className="h-56 w-full" />,
  ssr: false
});

function buildSevenDayTrend(items: Array<{ published_at: string }>, t: (key: string, values?: Record<string, number>) => string) {
  const counts = new Map<string, number>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    counts.set(date.toISOString().slice(0, 10), 0);
  }
  items.forEach((item) => {
    const key = item.published_at.slice(0, 10);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  return Array.from(counts.entries()).map(([day, value], index) => ({
    label: index === 6 ? t("trend.today") : t("trend.day", { count: 6 - index }),
    value
  }));
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: reportConfig, isLoading } = useReportConfig();
  const trendItems = useItems({ page_size: 100 });
  const lastCollection = useLastCollectionStats();
  const llmSettings = useLLMSettings();
  const { updateProfile, updateReportConfig, updateRetention } = useSettingsMutations();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const [displayName, setDisplayName] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
  const [retentionDays, setRetentionDays] = useState(30);
  const [reportPayload, setReportPayload] = useState<UserReportConfig>(defaultReportConfig);
  const [profileBaseline, setProfileBaseline] = useState({ displayName: "", locale });
  const [retentionBaseline, setRetentionBaseline] = useState(30);
  const [reportBaseline, setReportBaseline] = useState<UserReportConfig>(defaultReportConfig);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    setReportPayload(normalized);
    setReportBaseline(normalized);
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
  const sevenDayTrend = useMemo(
    () => buildSevenDayTrend(trendItems.data?.pages.flatMap((page) => page.items) ?? [], t),
    [t, trendItems.data]
  );

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
    <section className="flex flex-col gap-6 p-6 pb-24 lg:p-8">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-medium uppercase text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-foreground/60">{t("subtitle")}</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[auto_minmax(0,1fr)]">
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
            <ReportConfigSection payload={reportPayload} setPayload={setReportPayload} />
          )}
          <PasswordSection onOpen={() => setIsPasswordOpen(true)} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <LLMConfigSection
            configData={llmSettings.config.data}
            isConfigLoading={llmSettings.config.isLoading}
            isSaving={llmSettings.update.isPending}
            onSave={llmSettings.update.mutateAsync}
            usageData={llmSettings.usage.data}
          />
          <ThemeSection isDark={isDark} />
          <DataFreshnessCard
            isLoading={lastCollection.isLoading}
            lastSuccess={lastCollection.data?.last_success ?? null}
          />
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground">{t("trend.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("trend.caption")}</p>
            <div className="mt-5">
              <TrendLine
                data={sevenDayTrend}
              />
            </div>
          </Card>
        </div>
      </div>

      {user?.role === "admin" ? <AdminSettingsSection /> : null}

      <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-6xl rounded-full border border-border bg-card/95 p-2 shadow-apple backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 px-3 text-sm font-medium text-muted-foreground">
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

function ReportConfigSection({
  payload,
  setPayload
}: {
  payload: UserReportConfig;
  setPayload: (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => void;
}) {
  const t = useTranslations("settings");
  const activeReportFrequencies = payload.report_frequencies ?? (payload.report_frequency ? [payload.report_frequency] : []);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5">
        <h2 className="text-base font-semibold text-foreground">{t("reports.title")}</h2>
        <MultiSelectPills
          allLabel={t("reports.all")}
          label={t("reports.title")}
          onChange={(values) =>
            setPayload((current) => ({
              ...current,
              report_frequency: values[0] ?? "daily",
              report_frequencies: values
            }))
          }
          options={reportTypes.map((value) => ({ label: t(`reports.${value}`), value }))}
          values={activeReportFrequencies}
        />
        <MultiSelectPills
          allLabel={t("reports.allMarkets")}
          label={t("reports.markets")}
          onChange={(values) => setPayload((current) => ({ ...current, markets: values }))}
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
        <div className="flex items-center gap-3 text-sm font-medium text-foreground">
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
          <h2 className="text-base font-semibold text-foreground">{t("theme.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("theme.caption")}</p>
        </div>
        <span className="rounded-full bg-card px-3 py-1 text-sm font-medium text-foreground">
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
        <span className="rounded-full bg-primary/10 p-2 text-primary">
          <Clock3 className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{t("dataFreshness")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("lastUpdated")}</p>
          {isLoading ? (
            <Skeleton className="mt-4 h-5 w-40" />
          ) : (
            <p className="mt-4 text-sm font-medium text-foreground">{formatted}</p>
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
          <h2 className="text-base font-semibold text-foreground">{t("password.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("password.caption")}</p>
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

interface Option<T extends string = string> {
  label: string;
  value: T;
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
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            className={
              values.includes(option.value)
                ? "min-h-11 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background"
                : "min-h-11 rounded-full border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
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

function MultiSelectPills<T extends string>({
  allLabel,
  label,
  onChange,
  options,
  values
}: {
  allLabel: string;
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
          className={values.length === 0 ? activePillClass : inactivePillClass}
          onClick={() => onChange([])}
          type="button"
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            className={values.includes(option.value) ? activePillClass : inactivePillClass}
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

const activePillClass = "rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-200";
const inactivePillClass = "rounded-xl bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground";

function reportConfigsEqual(left: UserReportConfig, right: UserReportConfig) {
  return (
    left.is_active === right.is_active &&
    stringArraysEqual(reportFrequencies(left), reportFrequencies(right)) &&
    stringArraysEqual(left.categories, right.categories) &&
    stringArraysEqual(left.markets, right.markets)
  );
}

function normalizeReportConfig(config: UserReportConfig): UserReportConfig {
  return {
    ...config,
    report_frequencies: config.report_frequencies ?? (config.report_frequency ? [config.report_frequency] : [])
  };
}

function reportFrequencies(config: UserReportConfig): ReportType[] {
  return config.report_frequencies ?? (config.report_frequency ? [config.report_frequency] : []);
}

function stringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}
