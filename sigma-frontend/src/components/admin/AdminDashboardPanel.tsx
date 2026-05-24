"use client";

import { Activity, ChevronDown, ChevronUp, Database, RadioTower, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CustomSelect } from "@/components/dashboard/custom-select";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminDashboard, useAdminLogs } from "@/hooks/useAdmin";
import type { CollectorStatus } from "@/hooks/useAdmin";
import { useSources } from "@/hooks/useSources";
import { cn } from "@/lib/cn";

const statIcons = {
  users: Users,
  sources: RadioTower,
  items: Database,
  tokens: Activity
} as const;

const statuses: Array<CollectorStatus | "all"> = ["all", "success", "fail", "timeout"];

const TrendLine = dynamic(() => import("@/components/charts/TrendLine").then((module) => module.TrendLine), {
  loading: () => <Skeleton className="h-[240px] w-full" />,
  ssr: false
});

export function AdminDashboardPanel() {
  const t = useTranslations("admin.dashboard");
  const logsT = useTranslations("admin.logs");
  const statusT = useTranslations("admin.status");
  const { activity, health, stats, trend } = useAdminDashboard();
  const [sourceId, setSourceId] = useState("");
  const [status, setStatus] = useState<CollectorStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sources = useSources();
  const logs = useAdminLogs({ dateFrom, dateTo, page, sourceId, status });
  const today = new Date().toISOString().split("T")[0];
  const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const trendData =
    trend.data?.map((point) => ({
      label: new Date(point.day).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" }),
      value: point.items
    })) ?? [];

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-normal text-sigma-muted">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-sigma-text">{t("title")}</h1>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="users" label={t("stats.users")} value={stats.data?.users} />
        <StatCard icon="sources" label={t("stats.sources")} value={stats.data?.sources} />
        <StatCard icon="items" label={t("stats.items")} value={stats.data?.items} />
        <StatCard icon="tokens" label={t("stats.tokens")} value={stats.data?.tokens_today} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3 [&>*]:h-[420px]">
        <Card className="flex flex-col p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("trend")}</h2>
            <span className="text-xs font-medium text-sigma-muted">{t("refresh")}</span>
          </div>
          {trend.isLoading ? <Skeleton className="h-[280px] w-full" /> : <TrendLine data={trendData} variant="bar" />}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-sigma-line p-5">
            <h2 className="text-lg font-semibold">{t("activity")}</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            {(activity.data ?? []).map((item) => (
              <div className="grid grid-cols-[1fr_auto] gap-1 border-b border-sigma-line px-3 py-2" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sigma-text">{item.source_name}</p>
                  <p className="text-xs text-sigma-muted">
                    {item.items_count} {t("items")} · {new Date(item.executed_at).toLocaleString()}
                  </p>
                </div>
                <StatusPill label={statusT(item.status)} status={item.status} />
              </div>
            ))}
            {!activity.isLoading && (activity.data ?? []).length === 0 ? (
              <p className="p-5 text-sm text-sigma-muted">{t("emptyActivity")}</p>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-sigma-line p-5">
            <h2 className="text-lg font-semibold">{t("health")}</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-0 text-left text-sm">
              <thead className="bg-sigma-elevated text-xs uppercase tracking-normal text-sigma-muted">
                <tr>
                  <th className="px-3 py-3 font-medium">{t("source")}</th>
                  <th className="px-3 py-3 font-medium">{t("type")}</th>
                  <th className="px-3 py-3 font-medium">{t("lastSuccess")}</th>
                  <th className="px-3 py-3 font-medium">{t("rate")}</th>
                  <th className="px-3 py-3 font-medium">{t("state")}</th>
                </tr>
              </thead>
              <tbody>
                {(health.data ?? []).map((item) => (
                  <tr className="border-t border-sigma-line" key={item.source_id}>
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-sigma-muted">{item.source_type}</td>
                    <td className="px-3 py-2 text-sigma-muted">
                      {item.last_success ? new Date(item.last_success).toLocaleString() : t("never")}
                    </td>
                    <td className="px-3 py-2 text-sigma-muted">{Math.round(item.rate_24h * 100)}%</td>
                    <td className="px-3 py-2">
                      <HealthDot label={statusT(item.status)} status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <div>
        <p className="text-sm font-medium uppercase tracking-normal text-muted-foreground">{logsT("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">{logsT("title")}</h1>
      </div>

      <Card className="p-4">
        <div className="grid items-end gap-3 md:grid-cols-4">
          <CustomSelect
            label={logsT("source")}
            onChange={(value) => {
              setSourceId(value);
              setPage(1);
            }}
            options={[
              { label: logsT("allSources"), value: "" },
              ...(sources.data?.items ?? []).map((source) => ({ label: source.name, value: source.id }))
            ]}
            selectClassName="rounded-xl"
            value={sourceId}
          />
          <CustomSelect
            label={logsT("status")}
            onChange={(value) => {
              setStatus(value as CollectorStatus | "all");
              setPage(1);
            }}
            options={statuses.map((item) => ({
              label: item === "all" ? logsT("allStatuses") : statusT(item),
              value: item
            }))}
            selectClassName="rounded-xl"
            value={status}
          />
          <DateField label={logsT("from")} max={today} min={oneYearAgo} onChange={setDateFrom} value={dateFrom} />
          <DateField label={logsT("to")} max={today} min={dateFrom || oneYearAgo} onChange={setDateTo} value={dateTo} />
        </div>
      </Card>

      <div className="space-y-3">
        {(logs.data?.items ?? []).map((log) => {
          const isExpanded = expanded.has(log.id);
          return (
            <Card
              className={cn(
                "border-l-4 p-4",
                log.status === "success" ? "border-l-chart-1" : "",
                log.status === "fail" ? "border-l-chart-2" : "",
                log.status === "timeout" ? "border-l-chart-4" : ""
              )}
              key={log.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{log.source_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {statusT(log.status)} · {log.items_count} {logsT("items")} ·{" "}
                    {new Date(log.executed_at).toLocaleString()}
                  </p>
                </div>
                <button
                  aria-label={isExpanded ? logsT("collapse") : logsT("expand")}
                  className="flex h-11 w-11 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => toggle(log.id)}
                  type="button"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {isExpanded ? (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {log.error_message ?? logsT("successDetail", { count: log.items_count, duration: log.duration_ms })}
                </div>
              ) : null}
            </Card>
          );
        })}
        {!logs.isLoading && (logs.data?.items ?? []).length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">{logsT("empty")}</Card>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {logsT("footer", {
            rate: Math.round((logs.data?.success_rate ?? 0) * 100),
            total: logs.data?.total ?? 0
          })}
        </p>
        <div className="flex gap-2">
          <Button disabled={page === 1} onClick={() => setPage((current) => current - 1)} size="sm" variant="ghost">
            {logsT("previous")}
          </Button>
          <Button disabled={!logs.data?.has_next} onClick={() => setPage((current) => current + 1)} size="sm">
            {logsT("next")}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function DateField({
  label,
  max,
  min,
  onChange,
  value
}: {
  label: string;
  max: string;
  min: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Input
      className="cursor-pointer rounded-xl bg-card"
      label={label}
      max={max}
      min={min}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.currentTarget.showPicker?.()}
      type="date"
      value={value}
    />
  );
}

interface StatCardProps {
  icon: keyof typeof statIcons;
  label: string;
  value?: number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  const Icon = statIcons[icon];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sigma-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value ?? "—"}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sigma-elevated text-sigma-muted">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

function StatusPill({ label, status }: { label: string; status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium",
        status === "success" ? "bg-sigma-success/10 text-sigma-success" : "",
        status === "fail" ? "bg-sigma-danger/10 text-sigma-danger" : "",
        status === "timeout" ? "bg-sigma-warning/10 text-sigma-warning" : ""
      )}
    >
      {label}
    </span>
  );
}

function HealthDot({ label, status }: { label: string; status: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          status === "green" ? "bg-sigma-success" : "",
          status === "yellow" ? "bg-sigma-warning" : "",
          status === "red" ? "bg-sigma-danger" : ""
        )}
      />
      {label}
    </span>
  );
}
