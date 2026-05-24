"use client";

import { FileClock, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useAdminSources } from "@/hooks/useAdmin";
import type { AdminActivity } from "@/hooks/useAdmin";
import { apiFetch } from "@/lib/api";
import type { DataSource, Market } from "@/lib/types";
import { cn } from "@/lib/cn";

const regionColumns: Market[] = ["us", "cn", "hk", "jp", "eu", "global"];

export function AdminSourcesPanel() {
  const [logSource, setLogSource] = useState<DataSource | null>(null);
  const [logs, setLogs] = useState<AdminActivity[]>([]);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const t = useTranslations("admin.sources");
  const marketT = useTranslations("markets");
  const common = useTranslations("common");
  const toast = useToast();
  const adminSources = useAdminSources();

  const groupedSources = useMemo(() => {
    const groups = Object.fromEntries(regionColumns.map((market) => [market, [] as DataSource[]])) as Record<Market, DataSource[]>;
    for (const source of adminSources.list.data?.items ?? []) {
      groups[normalizeMarket(source.market)].push(source);
    }
    return groups;
  }, [adminSources.list.data]);

  const showLogs = async (source: DataSource) => {
    setLogSource(source);
    const response = await adminSources.logs.mutateAsync(source.id);
    setLogs(response.items);
  };

  const toggleSource = async (source: DataSource, checked: boolean) => {
    try {
      await adminSources.update.mutateAsync({ id: source.id, payload: { is_active: checked } });
      toast.showToast(t("saved"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  const syncSource = async (source: DataSource) => {
    setSyncingSourceId(source.id);
    try {
      await apiFetch(`/sources/${source.id}/collect`, { method: "POST" });
      toast.showToast(t("syncQueued"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("syncError"), "error");
    } finally {
      setSyncingSourceId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-sigma-muted">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-sigma-text">{t("title")}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {regionColumns.map((market) => {
          const sources = groupedSources[market];
          return (
            <section
              className="flex min-h-[280px] flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              key={market}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{marketT(`regionNames.${market}`)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t("sourceCount", { count: sources.length })}</p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {market.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {sources.map((source) => (
                  <div
                    className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2"
                    key={source.id}
                  >
                    <div className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground">
                      {source.name}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <ToggleSwitch
                        checked={source.is_active}
                        label={t("toggleSource", { name: source.name })}
                        onChange={(checked) => toggleSource(source, checked)}
                      />
                      {source.is_active ? (
                        <IconButton
                          disabled={syncingSourceId === source.id}
                          label={t("syncSource", { name: source.name })}
                          onClick={() => syncSource(source)}
                        >
                          <RefreshCw className={cn("h-4 w-4", syncingSourceId === source.id ? "animate-spin" : "")} aria-hidden />
                        </IconButton>
                      ) : null}
                      <IconButton label={t("logs")} onClick={() => showLogs(source)}>
                        <FileClock className="h-4 w-4" aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                ))}
                {sources.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">{t("emptyRegion")}</p>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        closeLabel={common("close")}
        isOpen={logSource !== null}
        onClose={() => {
          setLogSource(null);
          setLogs([]);
        }}
        title={logSource ? t("logsTitle", { name: logSource.name }) : t("logs")}
      >
        <div className="max-h-96 space-y-3 overflow-auto">
          {logs.map((log) => (
            <div className="rounded-lg border border-sigma-line p-3" key={log.id}>
              <p className="text-sm font-medium">{t(`logStatus.${log.status}`)}</p>
              <p className="text-xs text-sigma-muted">
                {log.items_count} {t("items")} · {new Date(log.executed_at).toLocaleString()}
              </p>
              {log.error_message ? <p className="mt-2 text-xs text-sigma-danger">{log.error_message}</p> : null}
            </div>
          ))}
          {logs.length === 0 ? <p className="text-sm text-sigma-muted">{t("emptyLogs")}</p> : null}
        </div>
      </Modal>
    </div>
  );
}

function IconButton({
  children,
  disabled = false,
  label,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function normalizeMarket(market: Market): Market {
  return regionColumns.includes(market) ? market : "global";
}
