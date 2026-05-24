"use client";

import { Activity, Database, RadioTower, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

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
  loading: () => <Skeleton className="h-[280px] w-full" />,
  ssr: false
});

export function AdminDashboardPanel() {
  const t = useTranslations("admin.dashboard");
  const statusT = useTranslations("admin.status");
  const { activity, health, stats, trend } = useAdminDashboard();
  const trendData =
    trend.data?.map((point) => ({
      label: new Date(point.day).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" }),
      value: point.items
    })) ?? [];

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

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
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
          <div className="overflow-x-auto">
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
    </div>
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
