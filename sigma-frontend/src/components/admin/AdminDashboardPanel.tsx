"use client";

import { Activity, Database, RadioTower, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { AdminDashboardLogs } from "@/components/admin/AdminDashboardLogs";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminDashboard } from "@/hooks/useAdmin";
import { cn } from "@/lib/cn";

const statIcons = {
  users: Users,
  sources: RadioTower,
  items: Database,
  tokens: Activity
} as const;

const TrendLine = dynamic(() => import("@/components/charts/TrendLine").then((module) => module.TrendLine), {
  loading: () => <Skeleton className="h-[240px] w-full" />,
  ssr: false
});

interface StatusPillProps {
  label: string;
  status: string;
}

interface HealthDotProps {
  label: string;
  status: string;
}

export function AdminDashboardPanel() {
  const t = useTranslations("admin.dashboard");
  const dashboard = useAdminDashboard();
  const { stats } = dashboard;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-normal text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="mt-2 text-[32px] font-bold text-foreground">{t("title")}</h1>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="users" label={t("stats.users")} value={stats.data?.users} />
        <StatCard icon="sources" label={t("stats.sources")} value={stats.data?.sources} />
        <StatCard icon="items" label={t("stats.items")} value={stats.data?.items} />
        <StatCard icon="tokens" label={t("stats.tokens")} value={stats.data?.tokens_today} />
      </section>
      <DashboardMetricPanels dashboard={dashboard} />
      <AdminDashboardLogs />
    </div>
  );
}

function DashboardMetricPanels({ dashboard }: { dashboard: ReturnType<typeof useAdminDashboard> }) {
  const t = useTranslations("admin.dashboard");
  const statusT = useTranslations("admin.status");
  const { activity, health, trend } = dashboard;
  const trendData =
    trend.data?.map((point) => ({
      label: new Date(point.day).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" }),
      value: point.items
    })) ?? [];
  return (
    <section className="grid gap-6 xl:grid-cols-3 [&>*]:h-[420px]">
        <Card className="flex flex-col p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t("trend")}</h2>
            <span className="text-xs font-bold text-muted-foreground">{t("refresh")}</span>
          </div>
          {trend.isLoading ? <Skeleton className="h-[280px] w-full" /> : <TrendLine data={trendData} variant="bar" />}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-6">
            <h2 className="text-lg font-bold">{t("activity")}</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            {(activity.data ?? []).map((item) => (
              <div className="grid grid-cols-[1fr_auto] gap-1 border-b border-border px-3 py-2" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{item.source_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.items_count} {t("items")} · {new Date(item.executed_at).toLocaleString()}
                  </p>
                </div>
                <StatusPill label={statusT(item.status)} status={item.status} />
              </div>
            ))}
            {!activity.isLoading && (activity.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("emptyActivity")}</p>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-6">
            <h2 className="text-lg font-bold">{t("health")}</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-0 text-left text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-normal text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-bold">{t("source")}</th>
                  <th className="px-3 py-3 font-bold">{t("type")}</th>
                  <th className="px-3 py-3 font-bold">{t("lastSuccess")}</th>
                  <th className="px-3 py-3 font-bold">{t("rate")}</th>
                  <th className="px-3 py-3 font-bold">{t("state")}</th>
                </tr>
              </thead>
              <tbody>
                {(health.data ?? []).map((item) => (
                  <tr className="border-t border-border" key={item.source_id}>
                    <td className="px-3 py-2 font-bold">{item.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.source_type}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.last_success ? new Date(item.last_success).toLocaleString() : t("never")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{Math.round(item.rate_24h * 100)}%</td>
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
    <Card className="p-6">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 text-[32px] font-bold">{value ?? "—"}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

function StatusPill({ label, status }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold",
        status === "success" ? "bg-chart-1/10 text-chart-1" : "",
        status === "fail" ? "bg-destructive/10 text-destructive" : "",
        status === "timeout" ? "bg-chart-4/10 text-chart-4" : ""
      )}
    >
      {label}
    </span>
  );
}

function HealthDot({ label, status }: HealthDotProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-bold">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          status === "green" ? "bg-chart-1" : "",
          status === "yellow" ? "bg-chart-4" : "",
          status === "red" ? "bg-destructive" : ""
        )}
      />
      {label}
    </span>
  );
}
