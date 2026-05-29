"use client";

import { Code, Database, Pencil, Plus, Rss, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useToast } from "@/components/ui/Toast";
import { useAdminUserSourceMutations, useAdminUserSources } from "@/hooks/useAdminUserDetail";
import type { Category, DataSource, Market, SourcePayload } from "@/lib/types";

const sourceTypes = ["rss", "api", "scraper"] as const;
const categories: Category[] = ["politics", "finance", "technology", "macro", "other"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw", "global"];

const initialPayload: SourcePayload = {
  category: "finance",
  config: { feed_url: "" },
  is_active: true,
  market: "us",
  max_execution_seconds: 60,
  name: "",
  schedule_cron: "0 * * * *",
  source_type: "rss"
};

interface AdminUserSourcesDetailProps {
  onSaveStateChange?: (state: { isDirty: boolean; isSaving: boolean; isValid: boolean }) => void;
  userId: string;
}

export const AdminUserSourcesDetail = forwardRef<
  { save: () => Promise<void> },
  AdminUserSourcesDetailProps
>(function AdminUserSourcesDetail({ onSaveStateChange, userId }, ref) {
  const t = useTranslations("sync");
  const common = useTranslations("common");
  const { showToast } = useToast();
  const sources = useAdminUserSources(userId);
  const mutations = useAdminUserSourceMutations(userId);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payload, setPayload] = useState<SourcePayload>(initialPayload);
  const [draftSources, setDraftSources] = useState<DataSource[]>([]);
  const baselineSourcesRef = useRef<DataSource[]>([]);
  const draftSourcesRef = useRef<DataSource[]>([]);
  const setSyncedDraftSources = useCallback((value: DataSource[] | ((current: DataSource[]) => DataSource[])) => {
    setDraftSources((current) => {
      const next = typeof value === "function" ? value(current) : value;
      draftSourcesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (sources.data?.items) {
      const nextSources = sources.data.items;
      if (
        !dataSourceListsEqual(draftSourcesRef.current, baselineSourcesRef.current) &&
        !dataSourceListsEqual(nextSources, draftSourcesRef.current)
      ) {
        return;
      }
      baselineSourcesRef.current = nextSources;
      draftSourcesRef.current = nextSources;
      setDraftSources(nextSources);
    }
  }, [sources.data?.items]);

  const groupedSources = useMemo(() => {
    const groups = Object.fromEntries(markets.map((market) => [market, [] as DataSource[]])) as Record<Market, DataSource[]>;
    for (const source of draftSources) {
      groups[markets.includes(source.market) ? source.market : "global"].push(source);
    }
    return groups;
  }, [draftSources]);

  const sourcesDirty = !dataSourceListsEqual(draftSources, baselineSourcesRef.current);
  const isSaving = mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;

  useEffect(() => {
    onSaveStateChange?.({ isDirty: sourcesDirty, isSaving, isValid: true });
  }, [isSaving, onSaveStateChange, sourcesDirty]);

  useImperativeHandle(
    ref,
    () => ({
      async save() {
        await persistSourceDraft({
          baselineSources: baselineSourcesRef.current,
          createSource: (source) => mutations.create.mutateAsync(sourcePayloadFromSource(source)),
          deleteSource: (sourceId) => mutations.remove.mutateAsync(sourceId),
          draftSources: draftSourcesRef.current,
          updateSource: (source) =>
            mutations.update.mutateAsync({ id: source.id, payload: sourcePayloadFromSource(source) })
        });
        const refreshed = await sources.refetch();
        const latest = refreshed.data?.items ?? draftSourcesRef.current.filter((source) => !isDraftSource(source));
        baselineSourcesRef.current = latest;
        draftSourcesRef.current = latest;
        setDraftSources(latest);
      }
    }),
    [mutations.create, mutations.remove, mutations.update, sources]
  );

  function openCreate() {
    setEditingSource(null);
    setPayload(initialPayload);
    setIsModalOpen(true);
  }

  function openEdit(source: DataSource) {
    setEditingSource(source);
    setPayload({
      category: source.category,
      config: source.config ?? defaultConfig(source.source_type),
      is_active: source.is_active,
      market: source.market,
      max_execution_seconds: source.max_execution_seconds ?? 60,
      name: source.name,
      schedule_cron: source.schedule_cron ?? "0 * * * *",
      source_type: source.source_type
    });
    setIsModalOpen(true);
  }

  function saveSource() {
    if (editingSource) {
      setSyncedDraftSources((current) =>
        current.map((source) => (source.id === editingSource.id ? { ...source, ...payload } : source))
      );
    } else {
      setSyncedDraftSources((current) => [draftSourceFromPayload(payload, userId), ...current]);
    }
    setIsModalOpen(false);
    showToast(t("staged"), "success");
  }

  function deleteSource(source: DataSource) {
    setSyncedDraftSources((current) => current.filter((entry) => entry.id !== source.id));
    showToast(t("staged"), "success");
  }

  function toggleSource(source: DataSource, checked: boolean) {
    setSyncedDraftSources((current) =>
      current.map((entry) => (entry.id === source.id ? { ...entry, is_active: checked } : entry))
    );
    showToast(t("staged"), "success");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("dataSources")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          {t("sources.add")}
        </Button>
      </div>

      {sources.isError ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("sourceUpdateError")}</Card>
      ) : sources.isLoading && draftSources.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-48 rounded-xl" key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {markets.map((market) => {
            const items = groupedSources[market];
            if (items.length === 0) {
              return null;
            }
            return (
              <section className="rounded-xl border border-border bg-card p-6" key={market}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-foreground">{t(`sources.markets.${market}`)}</h3>
                  <span className="rounded-2xl bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
                    {t("sources.sourceCount", { count: items.length })}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((source) => (
                    <SourceCard
                      key={source.id}
                      onDelete={() => deleteSource(source)}
                      onEdit={() => openEdit(source)}
                      onToggle={(checked) => toggleSource(source, checked)}
                      source={source}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {draftSources.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground md:col-span-2">{t("sources.emptyRegion")}</Card>
          ) : null}
        </div>
      )}

      <Modal
        closeLabel={common("close")}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSource ? t("sources.editTitle") : t("sources.addTitle")}
      >
        <SourceForm
          isSaving={false}
          onSave={saveSource}
          payload={payload}
          setPayload={(next) => setPayload((current) => ({ ...current, ...next }))}
        />
      </Modal>
    </div>
  );
});

function SourceCard({
  onDelete,
  onEdit,
  onToggle,
  source
}: {
  onDelete: () => void;
  onEdit: () => void;
  onToggle: (checked: boolean) => void;
  source: DataSource;
}) {
  const t = useTranslations("sync");
  const Icon = source.source_type === "rss" ? Rss : source.source_type === "scraper" ? Code : Database;

  return (
    <div className="rounded-xl border border-border bg-secondary p-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">{source.name}</p>
            <span className="rounded-2xl bg-card px-2 py-0.5 text-xs font-bold text-muted-foreground">
              {t(`sources.types.${source.source_type}`)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t(`sources.categories.${source.category}`)} · {t(`sources.markets.${source.market}`)} ·{" "}
            {source.schedule_cron ?? "0 * * * *"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{sourceConfigSummary(source)}</p>
        </div>
        <ToggleSwitch checked={source.is_active} label={t("sources.toggleSource", { name: source.name })} onChange={onToggle} />
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <IconButton label={t("configure")} onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden />
        </IconButton>
        <IconButton label={t("sources.delete")} onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}

function SourceForm({
  isSaving,
  onSave,
  payload,
  setPayload
}: {
  isSaving: boolean;
  onSave: () => void;
  payload: SourcePayload;
  setPayload: (payload: Partial<SourcePayload>) => void;
}) {
  const t = useTranslations("sync");
  const setConfig = (key: string, value: string) => setPayload({ config: { ...payload.config, [key]: value } });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t("sources.name")} labelMode="stacked" onChange={(event) => setPayload({ name: event.target.value })} value={payload.name} />
        <CustomSelect
          label={t("sources.type")}
          labelMode="stacked"
          onChange={(value) => setPayload({ config: defaultConfig(value as SourcePayload["source_type"]), source_type: value as SourcePayload["source_type"] })}
          options={sourceTypes.map((type) => ({ label: t(`sources.types.${type}`), value: type }))}
          value={payload.source_type}
        />
      </div>
      {payload.source_type === "rss" ? (
        <Input label={t("sources.fields.feedUrl")} labelMode="stacked" onChange={(event) => setConfig("feed_url", event.target.value)} value={String(payload.config.feed_url ?? "")} />
      ) : null}
      {payload.source_type === "api" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t("sources.fields.endpoint")} labelMode="stacked" onChange={(event) => setConfig("endpoint", event.target.value)} value={String(payload.config.endpoint ?? "")} />
          <Input label={t("sources.fields.itemsPath")} labelMode="stacked" onChange={(event) => setConfig("items_path", event.target.value)} value={String(payload.config.items_path ?? "")} />
        </div>
      ) : null}
      {payload.source_type === "scraper" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t("sources.fields.url")} labelMode="stacked" onChange={(event) => setConfig("url", event.target.value)} value={String(payload.config.url ?? "")} />
          <Input label={t("sources.fields.selector")} labelMode="stacked" onChange={(event) => setConfig("item_selector", event.target.value)} value={String(payload.config.item_selector ?? "")} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <CustomSelect label={t("sources.category")} labelMode="stacked" onChange={(value) => setPayload({ category: value as Category })} options={categories.map((category) => ({ label: t(`sources.categories.${category}`), value: category }))} value={payload.category} />
        <CustomSelect label={t("sources.market")} labelMode="stacked" onChange={(value) => setPayload({ market: value as Market })} options={markets.map((market) => ({ label: t(`sources.markets.${market}`), value: market }))} value={payload.market} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t("sources.cron")} labelMode="stacked" onChange={(event) => setPayload({ schedule_cron: event.target.value })} value={payload.schedule_cron} />
        <Input label={t("sources.timeout")} labelMode="stacked" min={1} onChange={(event) => setPayload({ max_execution_seconds: Number(event.target.value) })} type="number" value={payload.max_execution_seconds} />
      </div>
      <label className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ToggleSwitch checked={payload.is_active} label={t("sources.active")} onChange={(checked) => setPayload({ is_active: checked })} />
        {payload.is_active ? t("sources.active") : t("sources.inactive")}
      </label>
      <div className="flex justify-end">
        <Button disabled={!sourceConfigComplete(payload)} isLoading={isSaving} onClick={onSave}>
          {t("sources.save")}
        </Button>
      </div>
    </div>
  );
}

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

async function persistSourceDraft({
  baselineSources,
  createSource,
  deleteSource,
  draftSources,
  updateSource
}: {
  baselineSources: DataSource[];
  createSource: (source: DataSource) => Promise<unknown>;
  deleteSource: (sourceId: string) => Promise<unknown>;
  draftSources: DataSource[];
  updateSource: (source: DataSource) => Promise<unknown>;
}) {
  const draftById = new Map(draftSources.map((source) => [source.id, source]));
  const baselineById = new Map(baselineSources.map((source) => [source.id, source]));

  for (const source of baselineSources) {
    if (!draftById.has(source.id)) {
      await deleteSource(source.id);
    }
  }

  for (const source of draftSources) {
    if (isDraftSource(source)) {
      await createSource(source);
      continue;
    }
    const baseline = baselineById.get(source.id);
    if (baseline && !dataSourcesEqual(source, baseline)) {
      await updateSource(source);
    }
  }
}

function draftSourceFromPayload(payload: SourcePayload, userId: string): DataSource {
  return {
    ...payload,
    created_by: userId,
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    is_system: false
  };
}

function sourcePayloadFromSource(source: DataSource): SourcePayload {
  return {
    category: source.category,
    config: source.config ?? defaultConfig(source.source_type),
    is_active: source.is_active,
    market: source.market,
    max_execution_seconds: source.max_execution_seconds ?? 60,
    name: source.name,
    schedule_cron: source.schedule_cron ?? "0 * * * *",
    source_type: source.source_type
  };
}

function isDraftSource(source: DataSource) {
  return source.id.startsWith("draft-");
}

function dataSourceListsEqual(left: DataSource[], right: DataSource[]) {
  if (left.length !== right.length) {
    return false;
  }
  const rightById = new Map(right.map((source) => [source.id, source]));
  return left.every((source) => {
    const other = rightById.get(source.id);
    return other !== undefined && dataSourcesEqual(source, other);
  });
}

function dataSourcesEqual(left: DataSource, right: DataSource) {
  return (
    left.name === right.name &&
    left.source_type === right.source_type &&
    left.category === right.category &&
    left.market === right.market &&
    (left.schedule_cron ?? "0 * * * *") === (right.schedule_cron ?? "0 * * * *") &&
    (left.max_execution_seconds ?? 60) === (right.max_execution_seconds ?? 60) &&
    left.is_active === right.is_active &&
    stableStringify(left.config ?? {}) === stableStringify(right.config ?? {})
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${key}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function defaultConfig(type: SourcePayload["source_type"]): Record<string, unknown> {
  if (type === "api") {
    return { endpoint: "", items_path: "" };
  }
  if (type === "scraper") {
    return { item_selector: "", url: "" };
  }
  return { feed_url: "" };
}

function sourceConfigComplete(payload: SourcePayload) {
  if (!payload.name.trim()) return false;
  if (payload.source_type === "rss") return Boolean(String(payload.config.feed_url ?? "").trim());
  if (payload.source_type === "api") return Boolean(String(payload.config.endpoint ?? "").trim());
  return Boolean(String(payload.config.url ?? "").trim() && String(payload.config.item_selector ?? "").trim());
}

function sourceConfigSummary(source: DataSource) {
  const config = source.config ?? {};
  if (source.source_type === "rss") return String(config.feed_url ?? "");
  if (source.source_type === "api") return `${String(config.base_url ?? "")}${String(config.endpoint ?? "")}`;
  return String(config.target_url ?? config.url ?? "");
}
