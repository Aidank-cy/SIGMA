"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { useAdminLogs } from "@/hooks/useAdmin";
import type { CollectorStatus } from "@/hooks/useAdmin";
import { useSources } from "@/hooks/useSources";
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
  const sources = useSources();
  const logs = useAdminLogs({ dateFrom, dateTo, page, sourceId, status });
  const today = new Date().toISOString().split("T")[0];
  const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];

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
        <p className="text-sm font-medium uppercase tracking-normal text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">{t("title")}</h1>
      </div>

      <Card className="p-4">
        <div className="grid items-end gap-3 md:grid-cols-4">
          <CustomSelect
            label={t("source")}
            onChange={(value) => {
              setSourceId(value);
              setPage(1);
            }}
            options={[
              { label: t("allSources"), value: "" },
              ...(sources.data?.items ?? []).map((source) => ({ label: source.name, value: source.id }))
            ]}
            selectClassName="rounded-xl"
            value={sourceId}
          />
          <CustomSelect
            label={t("status")}
            onChange={(value) => {
              setStatus(value as CollectorStatus | "all");
              setPage(1);
            }}
            options={statuses.map((item) => ({
              label: item === "all" ? t("allStatuses") : statusT(item),
              value: item
            }))}
            selectClassName="rounded-xl"
            value={status}
          />
          <DateField label={t("from")} max={today} min={oneYearAgo} onChange={setDateFrom} value={dateFrom} />
          <DateField label={t("to")} max={today} min={dateFrom || oneYearAgo} onChange={setDateTo} value={dateTo} />
        </div>
      </Card>

      <div className="space-y-3">
        {(logs.data?.items ?? []).map((log) => {
          const expanded = log.status !== "success" && !collapsed.has(log.id);
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
                    {statusT(log.status)} · {log.items_count} {t("items")} ·{" "}
                    {new Date(log.executed_at).toLocaleString()}
                  </p>
                </div>
                <button
                  aria-label={expanded ? t("collapse") : t("expand")}
                  className="flex h-11 w-11 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => toggle(log.id)}
                  type="button"
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {expanded ? (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {log.error_message ?? t("successDetail", { duration: log.duration_ms })}
                </div>
              ) : null}
            </Card>
          );
        })}
        {!logs.isLoading && (logs.data?.items ?? []).length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">{t("empty")}</Card>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
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
