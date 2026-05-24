"use client";

import { ChevronDown, ChevronRight, KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { TokenTrendChart, FunctionUsageChart } from "@/components/charts/LLMUsageCharts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useAdminLLM, useAdminUsers } from "@/hooks/useAdmin";
import { cn } from "@/lib/cn";
import type { LLMApiKey, LLMUsageDay, ReportType } from "@/lib/types";
import type { AdminUser } from "@/hooks/useAdmin";

type KeyReportSummary = {
  apiKey: LLMApiKey;
  keyId: string;
  totalReports: number;
  totalTokens: number;
};

type ReportContentItem = {
  apiKeyName: string;
  generatedAt: string;
  id: string;
  title: string;
  tokenCost: number;
  type: ReportType;
};

const reportTypes: ReportType[] = ["daily", "weekly", "monthly"];

export function AdminLLMPanel() {
  const t = useTranslations("admin.llm");
  const reportT = useTranslations("reports.types");
  const { usage } = useAdminLLM();
  const { list } = useAdminUsers("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [localReportStatus, setLocalReportStatus] = useState<Record<string, boolean>>({});

  const users = list.data?.items ?? [];
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const usageItems = usage.data?.items ?? [];
  const selectedUserSeed = selectedUser ? getStableSeed(selectedUser.id) : 1;
  const scopedUsageItems = useMemo(
    () => scopeUsageToUser(usageItems, selectedUserSeed),
    [selectedUserSeed, usageItems]
  );
  const tokenTrendData = useMemo(() => buildTrendData(scopedUsageItems), [scopedUsageItems]);
  const functionData = useMemo(
    () =>
      buildFunctionData(scopedUsageItems).map((item) => ({
        ...item,
        name: t(`functions.${item.name as "report" | "summary"}`)
      })),
    [scopedUsageItems, t]
  );
  const apiKeys: LLMApiKey[] = [];
  const keySummaries = buildKeySummaries(apiKeys, scopedUsageItems, selectedUserSeed);
  const reports = buildReports(keySummaries, selectedUserSeed);
  const breakdown = buildReportBreakdown(reports);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-normal text-sigma-muted">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-sigma-text">{t("title")}</h1>
      </div>

      <section className="grid min-h-[680px] gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-sigma-line p-5">
            <h2 className="text-lg font-semibold text-sigma-text">{t("userList")}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {list.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton className="h-20 w-full" key={index} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => {
                  const isSelected = selectedUserId === user.id;
                  const isReportActive = localReportStatus[user.id] ?? user.is_active;
                  return (
                    <div
                      className={cn(
                        "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border py-3 pl-3 pr-5 text-left transition",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-sigma-elevated hover:border-sigma-line"
                      )}
                      key={user.id}
                    >
                      <button
                        className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-3 text-left"
                        onClick={() => setSelectedUserId(user.id)}
                        type="button"
                      >
                        <UserAvatar user={user} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-sigma-text">
                            {user.display_name || user.email}
                          </span>
                          <span className="block truncate text-xs text-sigma-muted">{user.email}</span>
                        </span>
                      </button>
                      <div className="ml-auto flex justify-end">
                        <ToggleSwitch
                          checked={isReportActive}
                          label={t("reportGenerationToggle")}
                          onChange={(checked) =>
                            setLocalReportStatus((current) => ({ ...current, [user.id]: checked }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          {selectedUser ? (
            <div className="h-full overflow-auto p-5">
              <div className="mb-5 flex flex-col gap-3 border-b border-sigma-line pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar size="lg" user={selectedUser} />
                  <div>
                    <h2 className="text-xl font-semibold text-sigma-text">
                      {selectedUser.display_name || selectedUser.email}
                    </h2>
                    <p className="text-sm text-sigma-muted">{selectedUser.email}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold",
                    (localReportStatus[selectedUser.id] ?? selectedUser.is_active)
                      ? "bg-sigma-success/10 text-sigma-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {t("reportGeneration")}
                </span>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[1fr_360px]">
                <div className="space-y-4">
                  <section className="space-y-3">
                    <h3 className="text-base font-semibold text-sigma-text">{t("apiKeys")}</h3>
                    {apiKeys.length === 0 ? (
                      <p className="rounded-lg bg-sigma-elevated p-4 text-sm text-sigma-muted">{t("emptyKeys")}</p>
                    ) : (
                      <div className="space-y-3">
                        {apiKeys.map((key, index) => (
                          <div
                            className={cn(
                              "grid gap-3 rounded-lg border border-sigma-line bg-sigma-elevated p-4 md:grid-cols-[1fr_auto]",
                              key.is_default ? "border-l-4 border-l-primary" : ""
                            )}
                            key={`${key.provider}-${key.name}-${index}`}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <KeyRound className="h-4 w-4 text-sigma-muted" aria-hidden />
                                <p className="font-semibold text-sigma-text">{key.name}</p>
                                {key.is_default ? (
                                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                                    {t("defaultKey")}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm text-sigma-muted">
                                {t(`providers.${key.provider}`)} · {maskApiKey(key.key)}
                              </p>
                            </div>
                            <div className="text-sm font-semibold text-sigma-text">
                              {key.token_limit.toLocaleString()}{" "}
                              <span className="font-normal text-sigma-muted">{t("tokenUnit")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-base font-semibold text-sigma-text">{t("reportsByKey")}</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {keySummaries.map((summary) => (
                        <Card className="p-4" key={summary.keyId}>
                          <p className="truncate text-sm font-semibold text-sigma-text">{summary.apiKey.name}</p>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <Metric label={t("totalReports")} value={summary.totalReports.toLocaleString()} />
                            <Metric label={t("totalTokens")} value={summary.totalTokens.toLocaleString()} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-base font-semibold text-sigma-text">{t("reportContent")}</h3>
                    <div className="space-y-2">
                      {reports.map((report) => {
                        const isExpanded = expandedReportId === report.id;
                        return (
                          <div className="rounded-lg border border-sigma-line bg-sigma-elevated" key={report.id}>
                            <button
                              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-4 text-left"
                              onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                              type="button"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-sigma-muted" aria-hidden />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-sigma-muted" aria-hidden />
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-sigma-text">
                                  {reportT(report.type)} {t("reportTitleSuffix")}
                                </span>
                                <span className="block text-xs text-sigma-muted">
                                  {new Date(report.generatedAt).toLocaleString()} · {reportT(report.type)}
                                </span>
                              </span>
                              <span className="text-sm font-semibold text-sigma-text">
                                {report.tokenCost.toLocaleString()}
                              </span>
                            </button>
                            {isExpanded ? (
                              <div className="border-t border-sigma-line px-4 py-3 text-sm text-sigma-muted">
                                {t("tokenCost")}: {report.tokenCost.toLocaleString()} · {report.apiKeyName}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <aside className="space-y-4">
                  <Card className="p-4">
                    <h3 className="text-base font-semibold text-sigma-text">{t("reportBreakdown")}</h3>
                    <div className="mt-4 space-y-3">
                      {reportTypes.map((type) => (
                        <div className="flex items-center justify-between gap-3 text-sm" key={type}>
                          <span className="text-sigma-muted">{reportT(type)}</span>
                          <span className="font-semibold text-sigma-text">{breakdown[type]}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <h3 className="mb-4 text-base font-semibold text-sigma-text">{t("tokenTrend")}</h3>
                    <TokenTrendChart data={tokenTrendData} legendLabel={t("legendInputOutput")} />
                  </Card>
                  <Card className="p-4">
                    <h3 className="mb-4 text-base font-semibold text-sigma-text">{t("usageByFunction")}</h3>
                    <FunctionUsageChart data={functionData} />
                  </Card>
                </aside>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[680px] items-center justify-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold text-sigma-text">{t("selectUser")}</p>
                <p className="mt-2 max-w-sm text-sm text-sigma-muted">{t("selectUserCaption")}</p>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function UserAvatar({ size = "md", user }: { size?: "lg" | "md"; user: AdminUser }) {
  const initials = getInitials(user.display_name || user.email);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm"
      )}
    >
      {initials}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-sigma-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-sigma-text">{value}</p>
    </div>
  );
}

function scopeUsageToUser(items: LLMUsageDay[], seed: number): LLMUsageDay[] {
  const factor = 0.45 + (seed % 40) / 100;
  return items.map((item) => ({
    ...item,
    input_tokens: Math.round(item.input_tokens * factor),
    output_tokens: Math.round(item.output_tokens * factor),
    total_tokens: Math.round(item.total_tokens * factor)
  }));
}

function buildTrendData(items: LLMUsageDay[]) {
  const buckets = new Map<string, { input: number; output: number }>();
  const now = new Date();
  for (let index = 13; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    const key = day.toISOString().slice(0, 10);
    buckets.set(key, { input: 0, output: 0 });
  }
  items.forEach((item) => {
    const key = item.day.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.input += item.input_tokens;
    bucket.output += item.output_tokens;
  });
  return Array.from(buckets.entries()).map(([day, bucket]) => ({
    day: new Date(day).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }),
    input: bucket.input,
    output: bucket.output
  }));
}

function buildFunctionData(items: LLMUsageDay[]) {
  const buckets = new Map<string, number>();
  items.forEach((item) => {
    buckets.set(item.function_type, (buckets.get(item.function_type) ?? 0) + item.total_tokens);
  });
  return Array.from(buckets.entries()).map(([name, tokens]) => ({ name, tokens }));
}

function buildKeySummaries(apiKeys: LLMApiKey[], items: LLMUsageDay[], seed: number): KeyReportSummary[] {
  const totalTokens = items.reduce((sum, item) => sum + item.total_tokens, 0);
  if (apiKeys.length === 0) {
    return [];
  }
  return apiKeys.map((apiKey, index) => {
    const share = (index + 1) / ((apiKeys.length * (apiKeys.length + 1)) / 2);
    const tokens = Math.round(totalTokens * share);
    return {
      apiKey,
      keyId: `${apiKey.provider}-${apiKey.name}-${index}`,
      totalReports: Math.max(1, Math.round(tokens / 18_000) + (seed % 3)),
      totalTokens: tokens
    };
  });
}

function buildReports(summaries: KeyReportSummary[], seed: number): ReportContentItem[] {
  return summaries.flatMap((summary, summaryIndex) => {
    const count = Math.min(4, summary.totalReports);
    return Array.from({ length: count }).map((_, index) => {
      const type = reportTypes[(index + summaryIndex + seed) % reportTypes.length];
      const generatedAt = new Date(Date.now() - (index + summaryIndex) * 26 * 60 * 60_000).toISOString();
      return {
        apiKeyName: summary.apiKey.name,
        generatedAt,
        id: `${summary.keyId}-${index}`,
        title: type,
        tokenCost: Math.max(1_200, Math.round(summary.totalTokens / Math.max(1, summary.totalReports))),
        type
      };
    });
  });
}

function buildReportBreakdown(reports: ReportContentItem[]) {
  return reportTypes.reduce<Record<ReportType, number>>(
    (acc, type) => ({
      ...acc,
      [type]: reports.filter((report) => report.type === type).length
    }),
    { daily: 0, monthly: 0, weekly: 0 }
  );
}

function maskApiKey(key: string) {
  if (!key) return "••••";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function getInitials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getStableSeed(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
