"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAdminLogs, useAdminSources } from "@/hooks/useAdmin";
import type { CollectorStatus } from "@/hooks/useAdmin";
import { cn } from "@/lib/cn";

const statuses: Array<CollectorStatus | "all"> = ["all", "success", "fail", "timeout"];

export function AdminLogsPanel() {
  const [sourceId, setSourceId] = useState("");
  const [status, setStatus] = useState<CollectorStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const t = useTranslations("admin.logs");
  const statusT = useTranslations("admin.status");
  const sources = useAdminSources();
  const logs = useAdminLogs({ dateFrom, dateTo, page, sourceId, status });

  const toggle = (id: string) => {
    setCollapsed((current) => {
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

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Select
            label={t("source")}
            onChange={(value) => {
              setSourceId(value);
              setPage(1);
            }}
            value={sourceId}
          >
            <option value="">{t("allSources")}</option>
            {(sources.list.data?.items ?? []).map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
          <Select
            label={t("status")}
            onChange={(value) => {
              setStatus(value as CollectorStatus | "all");
              setPage(1);
            }}
            value={status}
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? t("allStatuses") : statusT(item)}
              </option>
            ))}
          </Select>
          <DateField label={t("from")} onChange={setDateFrom} value={dateFrom} />
          <DateField label={t("to")} onChange={setDateTo} value={dateTo} />
        </div>
      </Card>

      <div className="space-y-3">
        {(logs.data?.items ?? []).map((log) => {
          const expanded = log.status !== "success" && !collapsed.has(log.id);
          return (
            <Card
              className={cn(
                "border-l-4 p-4",
                log.status === "success" ? "border-l-sigma-success" : "",
                log.status === "fail" ? "border-l-sigma-danger" : "",
                log.status === "timeout" ? "border-l-sigma-warning" : ""
              )}
              key={log.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{log.source_name}</p>
                  <p className="mt-1 text-sm text-sigma-muted">
                    {statusT(log.status)} · {log.items_count} {t("items")} ·{" "}
                    {new Date(log.executed_at).toLocaleString()}
                  </p>
                </div>
                <button
                  aria-label={expanded ? t("collapse") : t("expand")}
                  className="self-start rounded-full p-2 text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                  onClick={() => toggle(log.id)}
                  type="button"
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {expanded ? (
                <div className="mt-4 rounded-lg bg-sigma-elevated p-3 text-sm text-sigma-muted">
                  {log.error_message ?? t("successDetail", { duration: log.duration_ms })}
                </div>
              ) : null}
            </Card>
          );
        })}
        {!logs.isLoading && (logs.data?.items ?? []).length === 0 ? (
          <Card className="p-5 text-sm text-sigma-muted">{t("empty")}</Card>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 border-t border-sigma-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-sigma-muted">
          {t("footer", {
            rate: Math.round((logs.data?.success_rate ?? 0) * 100),
            total: logs.data?.total ?? 0
          })}
        </p>
        <div className="flex gap-2">
          <Button disabled={page === 1} onClick={() => setPage((current) => current - 1)} size="sm" variant="ghost">
            {t("previous")}
          </Button>
          <Button disabled={!logs.data?.has_next} onClick={() => setPage((current) => current + 1)} size="sm">
            {t("next")}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function DateField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-2 text-xs font-medium text-sigma-muted">
      <span>{label}</span>
      <input
        className="h-12 w-full rounded-2xl border border-sigma-line bg-sigma-elevated px-4 text-sm text-sigma-text outline-none focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function Select({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-2 text-xs font-medium text-sigma-muted">
      <span>{label}</span>
      <select
        className="h-12 w-full rounded-2xl border border-sigma-line bg-sigma-elevated px-4 text-sm text-sigma-text outline-none focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}
