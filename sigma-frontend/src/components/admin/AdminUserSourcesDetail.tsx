"use client";

import { Plus } from "lucide-react";
import type { ForwardedRef, MutableRefObject } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  dataSourceListsEqual,
  defaultConfig,
  draftSourceFromPayload,
  isDraftSource,
  persistSourceDraft,
  sourcePayloadFromSource
} from "@/components/admin/AdminUserSourcesDraft";
import { SourceCard, SourceForm, markets } from "@/components/admin/AdminUserSourcesParts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAdminUserSourceMutations, useAdminUserSources } from "@/hooks/useAdminUserDetail";
import type { DataSource, SourcePayload } from "@/lib/types";

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
  const state = useAdminUserSourcesDetailState(userId, onSaveStateChange, ref);
  return <AdminUserSourcesDetailContent {...state} />;
});

function useAdminUserSourcesDetailState(userId: string, onSaveStateChange: AdminUserSourcesDetailProps["onSaveStateChange"], ref: ForwardedRef<{ save: () => Promise<void> }>) {
  const t = useTranslations("sync");
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
      if (!dataSourceListsEqual(draftSourcesRef.current, baselineSourcesRef.current) && !dataSourceListsEqual(nextSources, draftSourcesRef.current)) {
        return;
      }
      baselineSourcesRef.current = nextSources;
      draftSourcesRef.current = nextSources;
      setDraftSources(nextSources);
    }
  }, [sources.data?.items]);

  const groupedSources = useMemo(() => {
    const groups = Object.fromEntries(markets.map((market) => [market, [] as DataSource[]])) as Record<(typeof markets)[number], DataSource[]>;
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

  useSourceSaveHandle({ baselineSourcesRef, draftSourcesRef, mutations, ref, setDraftSources, sources });

  function openCreate() {
    setEditingSource(null);
    setPayload(initialPayload);
    setIsModalOpen(true);
  }

  function openEdit(source: DataSource) {
    setEditingSource(source);
    setPayload(sourcePayloadFromSource({ ...source, config: source.config ?? defaultConfig(source.source_type) }));
    setIsModalOpen(true);
  }

  function saveSource() {
    if (editingSource) {
      setSyncedDraftSources((current) => current.map((source) => (source.id === editingSource.id ? { ...source, ...payload } : source)));
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
    setSyncedDraftSources((current) => current.map((entry) => (entry.id === source.id ? { ...entry, is_active: checked } : entry)));
    showToast(t("staged"), "success");
  }

  return { deleteSource, draftSources, editingSource, groupedSources, isModalOpen, openCreate, openEdit, payload, saveSource, setIsModalOpen, setPayload, sources, toggleSource };
}

function useSourceSaveHandle({
  baselineSourcesRef,
  draftSourcesRef,
  mutations,
  ref,
  setDraftSources,
  sources
}: {
  baselineSourcesRef: MutableRefObject<DataSource[]>;
  draftSourcesRef: MutableRefObject<DataSource[]>;
  mutations: ReturnType<typeof useAdminUserSourceMutations>;
  ref: ForwardedRef<{ save: () => Promise<void> }>;
  setDraftSources: (sources: DataSource[]) => void;
  sources: ReturnType<typeof useAdminUserSources>;
}) {
  useImperativeHandle(ref, () => ({
    async save() {
      await persistSourceDraft({
        baselineSources: baselineSourcesRef.current,
        createSource: (source) => mutations.create.mutateAsync(sourcePayloadFromSource(source)),
        deleteSource: (sourceId) => mutations.remove.mutateAsync(sourceId),
        draftSources: draftSourcesRef.current,
        updateSource: (source) => mutations.update.mutateAsync({ id: source.id, payload: sourcePayloadFromSource(source) })
      });
      const refreshed = await sources.refetch();
      const latest = refreshed.data?.items ?? draftSourcesRef.current.filter((source) => !isDraftSource(source));
      baselineSourcesRef.current = latest;
      draftSourcesRef.current = latest;
      setDraftSources(latest);
    }
  }), [baselineSourcesRef, draftSourcesRef, mutations.create, mutations.remove, mutations.update, setDraftSources, sources]);
}

function AdminUserSourcesDetailContent({
  deleteSource,
  draftSources,
  editingSource,
  groupedSources,
  isModalOpen,
  openCreate,
  openEdit,
  payload,
  saveSource,
  setIsModalOpen,
  setPayload,
  sources,
  toggleSource
}: ReturnType<typeof useAdminUserSourcesDetailState>) {
  const t = useTranslations("sync");
  const common = useTranslations("common");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("dataSources")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" aria-hidden />{t("sources.add")}</Button>
      </div>
      <SourcesGrid deleteSource={deleteSource} draftSources={draftSources} groupedSources={groupedSources} openEdit={openEdit} sources={sources} toggleSource={toggleSource} />
      <Modal closeLabel={common("close")} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSource ? t("sources.editTitle") : t("sources.addTitle")}>
        <SourceForm isSaving={false} onSave={saveSource} payload={payload} setPayload={(next) => setPayload((current) => ({ ...current, ...next }))} />
      </Modal>
    </div>
  );
}

function SourcesGrid({
  deleteSource,
  draftSources,
  groupedSources,
  openEdit,
  sources,
  toggleSource
}: Pick<ReturnType<typeof useAdminUserSourcesDetailState>, "deleteSource" | "draftSources" | "groupedSources" | "openEdit" | "sources" | "toggleSource">) {
  const t = useTranslations("sync");
  if (sources.isError) {
    return <Card className="p-6 text-sm text-muted-foreground">{t("sourceUpdateError")}</Card>;
  }
  if (sources.isLoading && draftSources.length === 0) {
    return <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-48 rounded-xl" key={index} />)}</div>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {markets.map((market) => {
        const items = groupedSources[market];
        if (items.length === 0) return null;
        return (
          <section className="rounded-xl border border-border bg-card p-6" key={market}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-foreground">{t(`sources.markets.${market}`)}</h3>
              <span className="rounded-2xl bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">{t("sources.sourceCount", { count: items.length })}</span>
            </div>
            <div className="space-y-3">
              {items.map((source) => <SourceCard key={source.id} onDelete={() => deleteSource(source)} onEdit={() => openEdit(source)} onToggle={(checked) => toggleSource(source, checked)} source={source} />)}
            </div>
          </section>
        );
      })}
      {draftSources.length === 0 ? <Card className="p-6 text-sm text-muted-foreground md:col-span-2">{t("sources.emptyRegion")}</Card> : null}
    </div>
  );
}
