"use client";

import { Moon, Save, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { TrendLine } from "@/components/charts/TrendLine";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useReportConfig, useSettingsMutations } from "@/hooks/useSettings";
import type { Category, Locale, Market, ReportType, UserReportConfig } from "@/lib/types";

const retentionOptions = [7, 30, 60, 90, 180, 365] as const;
const categories: Category[] = ["politics", "finance", "technology", "macro"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "global"];
const reportTypes: ReportType[] = ["daily", "weekly", "monthly"];

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale() as Locale;
  const { user } = useAuth();
  const { data: reportConfig, isLoading } = useReportConfig();

  return (
    <section className="flex flex-col gap-6">
      <header className="border-b border-sigma-line pb-6">
        <p className="text-sm font-medium uppercase text-sigma-accent">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-sigma-text sm:text-4xl">{t("title")}</h1>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          {user ? <ProfileSection defaultLocale={locale} /> : <Skeleton className="h-60 rounded-2xl" />}
          {user ? <RetentionSection /> : <Skeleton className="h-44 rounded-2xl" />}
          {isLoading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (
            <ReportConfigSection config={reportConfig} />
          )}
          <PasswordSection />
        </div>
        <div className="flex flex-col gap-5">
          <ThemeSection />
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
    </section>
  );
}

function ProfileSection({ defaultLocale }: { defaultLocale: Locale }) {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const { showToast } = useToast();
  const { updateProfile } = useSettingsMutations();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [locale, setLocale] = useState<Locale>(user?.locale ?? defaultLocale);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateProfile.mutateAsync({ display_name: displayName, locale });
    showToast(t("saved"), "success");
  }

  return (
    <Card className="p-5">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <h2 className="text-base font-semibold text-sigma-text">{t("profile.title")}</h2>
        <Input label={t("profile.displayName")} onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
        <label className="space-y-2">
          <span className="text-sm font-medium text-sigma-text">{t("profile.language")}</span>
          <select
            className="h-11 w-full rounded-full border border-sigma-line bg-sigma-elevated px-4 text-sm text-sigma-text outline-none focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15"
            onChange={(event) => setLocale(event.target.value as Locale)}
            value={locale}
          >
            <option value="zh">{t("profile.zh")}</option>
            <option value="en">{t("profile.en")}</option>
          </select>
        </label>
        <Button className="self-start" isLoading={updateProfile.isPending} type="submit">
          <Save className="h-4 w-4" aria-hidden />
          {t("save")}
        </Button>
      </form>
    </Card>
  );
}

function RetentionSection() {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const { showToast } = useToast();
  const { updateRetention } = useSettingsMutations();
  const [days, setDays] = useState(user?.data_retention_days ?? 30);

  async function handleSave() {
    await updateRetention.mutateAsync({ data_retention_days: days });
    showToast(t("saved"), "success");
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-sigma-text">{t("retention.title")}</h2>
        <div className="flex flex-wrap gap-2">
          {retentionOptions.map((option) => (
            <button
              className={
                days === option
                  ? "rounded-full bg-sigma-text px-4 py-2 text-sm font-medium text-sigma-bg"
                  : "rounded-full border border-sigma-line px-4 py-2 text-sm font-medium text-sigma-muted hover:text-sigma-text"
              }
              key={option}
              onClick={() => setDays(option)}
              type="button"
            >
              {t("retention.days", { count: option })}
            </button>
          ))}
        </div>
        <Button className="self-start" isLoading={updateRetention.isPending} onClick={handleSave}>
          <Save className="h-4 w-4" aria-hidden />
          {t("save")}
        </Button>
      </div>
    </Card>
  );
}

function ReportConfigSection({ config }: { config?: UserReportConfig }) {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { updateReportConfig } = useSettingsMutations();
  const [payload, setPayload] = useState<UserReportConfig>(
    config ?? { categories: [], is_active: true, markets: [], report_frequency: "daily" }
  );

  useEffect(() => {
    if (config) {
      setPayload(config);
    }
  }, [config]);

  async function handleSave() {
    await updateReportConfig.mutateAsync(payload);
    showToast(t("saved"), "success");
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5">
        <h2 className="text-base font-semibold text-sigma-text">{t("reports.title")}</h2>
        <Segmented
          onChange={(value) => setPayload((current) => ({ ...current, report_frequency: value as ReportType }))}
          options={reportTypes.map((value) => ({ label: t(`reports.${value}`), value }))}
          value={payload.report_frequency}
        />
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
        <label className="flex items-center gap-3 text-sm font-medium text-sigma-text">
          <input
            checked={payload.is_active}
            className="h-4 w-4 rounded border-sigma-line"
            onChange={(event) =>
              setPayload((current) => ({ ...current, is_active: event.target.checked }))
            }
            type="checkbox"
          />
          {t("reports.active")}
        </label>
        <Button className="self-start" isLoading={updateReportConfig.isPending} onClick={handleSave}>
          <Save className="h-4 w-4" aria-hidden />
          {t("save")}
        </Button>
      </div>
    </Card>
  );
}

function ThemeSection() {
  const t = useTranslations("settings");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("sigma.theme", next ? "dark" : "light");
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-sigma-text">{t("theme.title")}</h2>
          <p className="mt-1 text-sm text-sigma-muted">{t("theme.caption")}</p>
        </div>
        <Button aria-label={t("theme.title")} onClick={toggleTheme} variant="secondary">
          {isDark ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
          {isDark ? t("theme.dark") : t("theme.light")}
        </Button>
      </div>
    </Card>
  );
}

function PasswordSection() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { updatePassword } = useSettingsMutations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updatePassword.mutateAsync({
      current_password: currentPassword,
      new_password: newPassword
    });
    setCurrentPassword("");
    setNewPassword("");
    showToast(t("saved"), "success");
  }

  return (
    <Card className="p-5">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <h2 className="text-base font-semibold text-sigma-text">{t("password.title")}</h2>
        <Input
          label={t("password.current")}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          value={currentPassword}
        />
        <Input
          label={t("password.next")}
          onChange={(event) => setNewPassword(event.target.value)}
          type="password"
          value={newPassword}
        />
        <Button className="self-start" isLoading={updatePassword.isPending} type="submit">
          <Save className="h-4 w-4" aria-hidden />
          {t("save")}
        </Button>
      </form>
    </Card>
  );
}

interface Option {
  label: string;
  value: string;
}

function Segmented({ onChange, options, value }: { onChange: (value: string) => void; options: Option[]; value: string }) {
  return (
    <div className="inline-flex w-fit rounded-full border border-sigma-line bg-sigma-bg p-1">
      {options.map((option) => (
        <button
          className={
            value === option.value
              ? "rounded-full bg-sigma-text px-4 py-2 text-sm font-medium text-sigma-bg"
              : "rounded-full px-4 py-2 text-sm font-medium text-sigma-muted hover:text-sigma-text"
          }
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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
