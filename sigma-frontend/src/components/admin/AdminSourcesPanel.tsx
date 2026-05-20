"use client";

import { CheckCircle2, FileClock, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminSources } from "@/hooks/useAdmin";
import type { AdminActivity } from "@/hooks/useAdmin";
import type { Category, DataSource, Market, SourcePayload } from "@/lib/types";
import { cn } from "@/lib/cn";

const sourceTypes = ["rss", "api", "scraper"] as const;
const categories: Category[] = ["politics", "finance", "technology", "macro", "other"];
const markets: Market[] = ["us", "cn", "jp", "eu", "hk", "global"];
const presets = [
  { key: "5m", cron: "*/5 * * * *" },
  { key: "hourly", cron: "0 * * * *" },
  { key: "daily", cron: "0 8 * * *" }
] as const;

type TranslationFn = ReturnType<typeof useTranslations>;

const initialPayload: SourcePayload = {
  name: "",
  source_type: "rss",
  category: "finance",
  market: "us",
  config: { feed_url: "" },
  schedule_cron: "*/5 * * * *",
  max_execution_seconds: 60,
  is_active: true
};

export function AdminSourcesPanel() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payload, setPayload] = useState<SourcePayload>(initialPayload);
  const [tested, setTested] = useState(false);
  const [logSource, setLogSource] = useState<DataSource | null>(null);
  const [logs, setLogs] = useState<AdminActivity[]>([]);
  const t = useTranslations("admin.sources");
  const common = useTranslations("common");
  const toast = useToast();
  const adminSources = useAdminSources();

  const nextRun = useMemo(() => new Date(Date.now() + 60 * 60 * 1000).toLocaleString(), []);

  const updatePayload = (next: Partial<SourcePayload>) => {
    setPayload((current) => ({ ...current, ...next }));
    setTested(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setPayload(initialPayload);
    setTested(false);
    setStep(1);
    setWizardOpen(true);
  };

  const openEdit = (source: DataSource) => {
    setEditingId(source.id);
    setPayload({
      name: source.name,
      source_type: source.source_type,
      category: source.category,
      market: source.market,
      config: source.config ?? defaultConfig(source.source_type),
      schedule_cron: source.schedule_cron ?? "*/5 * * * *",
      max_execution_seconds: source.max_execution_seconds ?? 60,
      is_active: source.is_active
    });
    setTested(false);
    setStep(2);
    setWizardOpen(true);
  };

  const runPreview = async () => {
    try {
      const response = await adminSources.preview.mutateAsync(payload);
      setTested(true);
      toast.showToast(t("testOk", { count: response.items.length }), "success");
    } catch (error) {
      setTested(false);
      toast.showToast(error instanceof Error ? error.message : t("testError"), "error");
    }
  };

  const saveSource = async () => {
    try {
      if (editingId) {
        await adminSources.update.mutateAsync({ id: editingId, payload });
      } else {
        await adminSources.create.mutateAsync(payload);
      }
      toast.showToast(t("saved"), "success");
      setWizardOpen(false);
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  const showLogs = async (source: DataSource) => {
    setLogSource(source);
    const response = await adminSources.logs.mutateAsync(source.id);
    setLogs(response.items);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-sigma-muted">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-sigma-text">{t("title")}</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("add")}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-sigma-elevated text-xs uppercase tracking-normal text-sigma-muted">
              <tr>
                <th className="px-5 py-3 font-medium">{t("name")}</th>
                <th className="px-5 py-3 font-medium">{t("type")}</th>
                <th className="px-5 py-3 font-medium">{t("category")}</th>
                <th className="px-5 py-3 font-medium">{t("market")}</th>
                <th className="px-5 py-3 font-medium">{t("cron")}</th>
                <th className="px-5 py-3 font-medium">{t("status")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(adminSources.list.data?.items ?? []).map((source) => (
                <tr className="border-t border-sigma-line" key={source.id}>
                  <td className="px-5 py-4 font-medium">{source.name}</td>
                  <td className="px-5 py-4 text-sigma-muted">{t(`types.${source.source_type}`)}</td>
                  <td className="px-5 py-4 text-sigma-muted">{t(`categories.${source.category}`)}</td>
                  <td className="px-5 py-4 text-sigma-muted">{t(`markets.${source.market}`)}</td>
                  <td className="px-5 py-4 text-sigma-muted">{source.schedule_cron}</td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        source.is_active
                          ? "bg-sigma-success/10 text-sigma-success"
                          : "bg-sigma-danger/10 text-sigma-danger"
                      )}
                    >
                      {source.is_active ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => openEdit(source)} size="sm" variant="ghost">
                        <Pencil className="h-4 w-4" aria-hidden />
                        {t("edit")}
                      </Button>
                      <Button onClick={() => showLogs(source)} size="sm" variant="ghost">
                        <FileClock className="h-4 w-4" aria-hidden />
                        {t("logs")}
                      </Button>
                      <Button
                        onClick={() => adminSources.remove.mutate(source.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        {t("delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        closeLabel={common("close")}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={editingId ? t("editTitle") : t("addTitle")}
      >
        <div className="space-y-5">
          <StepIndicator step={step} t={t} />
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {sourceTypes.map((type) => (
                <button
                  className={cn(
                    "rounded-lg border p-4 text-left text-sm font-medium",
                    payload.source_type === type
                      ? "border-sigma-accent bg-sigma-accent/10 text-sigma-text"
                      : "border-sigma-line text-sigma-muted hover:bg-sigma-surface"
                  )}
                  key={type}
                  onClick={() => updatePayload({ source_type: type, config: defaultConfig(type) })}
                  type="button"
                >
                  {t(`types.${type}`)}
                </button>
              ))}
            </div>
          ) : null}
          {step === 2 ? <ConfigStep payload={payload} setPayload={updatePayload} t={t} /> : null}
          {step === 3 ? (
            <MetadataStep nextRun={nextRun} payload={payload} setPayload={updatePayload} t={t} />
          ) : null}
          {step === 4 ? (
            <div className="space-y-4">
              <Button isLoading={adminSources.preview.isPending} onClick={runPreview} variant="secondary">
                <Play className="h-4 w-4" aria-hidden />
                {t("runTest")}
              </Button>
              {tested ? (
                <p className="flex items-center gap-2 text-sm font-medium text-sigma-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t("tested")}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button disabled={step === 1} onClick={() => setStep((current) => current - 1)} variant="ghost">
              {t("back")}
            </Button>
            {step < 4 ? (
              <Button disabled={!payload.name && step > 1} onClick={() => setStep((current) => current + 1)}>
                {t("next")}
              </Button>
            ) : (
              <Button disabled={!tested} isLoading={adminSources.create.isPending} onClick={saveSource}>
                {t("save")}
              </Button>
            )}
          </div>
        </div>
      </Modal>

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

function ConfigStep({
  payload,
  setPayload,
  t
}: {
  payload: SourcePayload;
  setPayload: (payload: Partial<SourcePayload>) => void;
  t: TranslationFn;
}) {
  const setConfig = (key: string, value: string) => {
    setPayload({ config: { ...payload.config, [key]: value } });
  };
  return (
    <div className="space-y-4">
      <Input label={t("name")} onChange={(event) => setPayload({ name: event.target.value })} value={payload.name} />
      {payload.source_type === "rss" ? (
        <Input
          label={t("fields.feedUrl")}
          onChange={(event) => setConfig("feed_url", event.target.value)}
          value={String(payload.config.feed_url ?? "")}
        />
      ) : null}
      {payload.source_type === "api" ? (
        <>
          <Input
            label={t("fields.endpoint")}
            onChange={(event) => setConfig("endpoint", event.target.value)}
            value={String(payload.config.endpoint ?? "")}
          />
          <Input
            label={t("fields.itemsPath")}
            onChange={(event) => setConfig("items_path", event.target.value)}
            value={String(payload.config.items_path ?? "")}
          />
        </>
      ) : null}
      {payload.source_type === "scraper" ? (
        <>
          <Input
            label={t("fields.url")}
            onChange={(event) => setConfig("url", event.target.value)}
            value={String(payload.config.url ?? "")}
          />
          <Input
            label={t("fields.selector")}
            onChange={(event) => setConfig("item_selector", event.target.value)}
            value={String(payload.config.item_selector ?? "")}
          />
        </>
      ) : null}
    </div>
  );
}

function MetadataStep({
  nextRun,
  payload,
  setPayload,
  t
}: {
  nextRun: string;
  payload: SourcePayload;
  setPayload: (payload: Partial<SourcePayload>) => void;
  t: TranslationFn;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <CustomSelect
          label={t("category")}
          onChange={(value) => setPayload({ category: value as Category })}
          options={categories.map((category) => ({ label: t(`categories.${category}`), value: category }))}
          value={payload.category}
        />
        <CustomSelect
          label={t("market")}
          onChange={(value) => setPayload({ market: value as Market })}
          options={markets.map((market) => ({ label: t(`markets.${market}`), value: market }))}
          value={payload.market}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            className="min-h-11 rounded-full border border-sigma-line px-3 py-1.5 text-xs font-medium text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
            key={preset.key}
            onClick={() => setPayload({ schedule_cron: preset.cron })}
            type="button"
          >
            {t(`presets.${preset.key}`)}
          </button>
        ))}
      </div>
      <Input
        label={t("cron")}
        onChange={(event) => setPayload({ schedule_cron: event.target.value })}
        value={payload.schedule_cron}
      />
      <Input
        label={t("timeout")}
        min={1}
        onChange={(event) => setPayload({ max_execution_seconds: Number(event.target.value) })}
        type="number"
        value={payload.max_execution_seconds}
      />
      <p className="text-sm text-sigma-muted">{t("nextRun", { time: nextRun })}</p>
    </div>
  );
}

function StepIndicator({ step, t }: { step: number; t: TranslationFn }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((item) => (
        <div
          className={cn(
            "h-1.5 rounded-full",
            item <= step ? "bg-sigma-accent" : "bg-sigma-line"
          )}
          key={item}
          title={t(`steps.${item}`)}
        />
      ))}
    </div>
  );
}

function defaultConfig(type: SourcePayload["source_type"]): Record<string, unknown> {
  if (type === "api") {
    return { endpoint: "", items_path: "" };
  }
  if (type === "scraper") {
    return { url: "", item_selector: "" };
  }
  return { feed_url: "" };
}
