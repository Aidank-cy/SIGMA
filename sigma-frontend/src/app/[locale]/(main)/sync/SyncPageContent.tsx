"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/Toast";
import type { AdminLogResponse } from "@/hooks/useAdmin";
import { useItems } from "@/hooks/useItems";
import { useSources } from "@/hooks/useSources";
import { apiFetch } from "@/lib/api";
import type { DataSource, Market, PaginatedResponse, SourcePayload } from "@/lib/types";

import { SourcesSection, SourceWizardModal, SyncHeader, SyncStatusCards, UserLogsPanel } from "./SyncPageParts";
import { buildMockLogResponse, defaultConfig, initialPayload, normalizeMarket, regionColumns, sourceConfigComplete, todayStart, type LogFilter, type SourcePreviewResponse } from "./SyncPageUtils";

type Mutate = () => unknown;
type LogQueryInput = { dateFrom: string; dateTo: string; page: number; sourceId: string; status: LogFilter };
type SourceActionInput = { mutate: Mutate; mutateItems: Mutate; setIsSyncing: (value: boolean) => void; setLogPage: (page: number) => void; setLogRefreshTick: (value: (current: number) => number) => void; setSyncingSourceId: (id: string | null) => void; sources: DataSource[] };
type WizardActionInput = { editingId: string | null; mutate: Mutate; payload: SourcePayload; setEditingId: (id: string | null) => void; setPayload: (value: SourcePayload | ((current: SourcePayload) => SourcePayload)) => void; setSavingSource: (value: boolean) => void; setStep: (value: number | ((current: number) => number)) => void; setTested: (value: boolean) => void; setTestingSource: (value: boolean) => void; setWizardOpen: (value: boolean) => void };

export function SyncPageContent() {
  const state = useSyncPageState();
  const sourceActions = useSourceActions({ mutate: state.mutate, mutateItems: state.todayItems.mutate, setIsSyncing: state.setIsSyncing, setLogPage: state.setLogPage, setLogRefreshTick: state.setLogRefreshTick, setSyncingSourceId: state.setSyncingSourceId, sources: state.sources });
  const wizardActions = useWizardActions({ editingId: state.editingId, mutate: state.mutate, payload: state.payload, setEditingId: state.setEditingId, setPayload: state.setPayload, setSavingSource: state.setSavingSource, setStep: state.setStep, setTested: state.setTested, setTestingSource: state.setTestingSource, setWizardOpen: state.setWizardOpen });

  function showSourceLogs(source: DataSource) {
    state.setLogSourceId(source.id);
    state.setLogPage(1);
    setTimeout(() => state.logsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <SyncHeader handleSyncAll={sourceActions.handleSyncAll} isSyncing={state.isSyncing} lastLogDate={state.logs?.items[0]?.executed_at} sourcesLength={state.sources.length} />
      <SyncStatusCards activeSources={state.activeSources} pipelineHealth={state.pipelineHealth} sourcesLength={state.sources.length} todayTotal={state.todayTotal} />
      <SourcesSection activeMarkets={state.activeMarkets} groupedSources={state.groupedSources} handleDeleteSource={sourceActions.handleDeleteSource} handleSyncSource={sourceActions.handleSyncSource} handleToggleSource={sourceActions.handleToggleSource} isLoading={state.isLoading} openCreate={wizardActions.openCreate} openEdit={wizardActions.openEdit} setActiveMarkets={state.setActiveMarkets} showSourceLogs={showSourceLogs} syncingSourceId={state.syncingSourceId} visibleRegionColumns={state.visibleRegionColumns} />
      <section className="scroll-mt-6" ref={state.logsSectionRef}>
        <UserLogsPanel dateFrom={state.dateFrom} dateTo={state.dateTo} logs={state.logs} onDateFromChange={(value) => { state.setDateFrom(value); state.setLogPage(1); }} onDateToChange={(value) => { state.setDateTo(value); state.setLogPage(1); }} onPageChange={state.setLogPage} onSourceChange={(value) => { state.setLogSourceId(value); state.setLogPage(1); }} onStatusChange={(value) => { state.setLogStatus(value); state.setLogPage(1); }} page={state.logPage} sourceId={state.logSourceId} sources={state.sources} status={state.logStatus} />
      </section>
      <SourceWizardModal editingId={state.editingId} nextRun={state.nextRun} payload={state.payload} runPreview={wizardActions.runPreview} saveSource={wizardActions.saveSource} savingSource={state.savingSource} setStep={state.setStep} setWizardOpen={state.setWizardOpen} step={state.step} tested={state.tested} testingSource={state.testingSource} updatePayload={wizardActions.updatePayload} wizardOpen={state.wizardOpen} />
    </div>
  );
}

function useSyncPageState() {
  const { data, isLoading, mutate } = useSources();
  const todayIso = useMemo(() => todayStart(), []);
  const todayItems = useItems({ date_from: todayIso, page_size: 1 });
  const sources = useMemo(() => data?.items ?? [], [data?.items]);
  const activeSources = sources.filter((source) => source.is_active).length;
  const todayTotal = todayItems.data?.pages[0]?.total ?? 0;
  const pipelineHealth = sources.length === 0 ? 0 : Math.round((activeSources / sources.length) * 100);
  const [isSyncing, setIsSyncing] = useState(false), [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false), [step, setStep] = useState(1), [editingId, setEditingId] = useState<string | null>(null);
  const [payload, setPayload] = useState<SourcePayload>(initialPayload), [tested, setTested] = useState(false), [savingSource, setSavingSource] = useState(false), [testingSource, setTestingSource] = useState(false);
  const [logSourceId, setLogSourceId] = useState(""), [logStatus, setLogStatus] = useState<LogFilter>("all"), [dateFrom, setDateFrom] = useState(""), [dateTo, setDateTo] = useState("");
  const [activeMarkets, setActiveMarkets] = useState<Market[]>([]), [logPage, setLogPage] = useState(1), [logRefreshTick, setLogRefreshTick] = useState(0);
  const [logs, setLogs] = useState<AdminLogResponse | null>(null);
  const logsSectionRef = useRef<HTMLElement>(null);
  const nextRun = useMemo(() => new Date(Date.now() + 60 * 60 * 1000).toLocaleString(), []);
  const groupedSources = useMemo(() => {
    const groups = Object.fromEntries(regionColumns.map((market) => [market, [] as DataSource[]])) as Record<Market, DataSource[]>;
    for (const source of sources) groups[normalizeMarket(source.market)].push(source);
    return groups;
  }, [sources]);
  const visibleRegionColumns = useMemo(() => (activeMarkets.length === 0 ? regionColumns : regionColumns.filter((market) => activeMarkets.includes(market))), [activeMarkets]);
  const logQuery = useMemo(() => buildLogQuery({ dateFrom, dateTo, page: logPage, sourceId: logSourceId, status: logStatus }), [dateFrom, dateTo, logPage, logSourceId, logStatus]);
  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminLogResponse>(`/sources/logs?${logQuery}`).then((response) => { if (!cancelled) setLogs(response); }).catch(() => {
      if (!cancelled) setLogs(buildMockLogResponse(sources, { dateFrom, dateTo, page: logPage, sourceId: logSourceId, status: logStatus }));
    });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, logPage, logQuery, logRefreshTick, logSourceId, logStatus, sources]);
  return { activeMarkets, activeSources, dateFrom, dateTo, editingId, groupedSources, isLoading, isSyncing, logPage, logSourceId, logStatus, logs, logsSectionRef, mutate, nextRun, payload, pipelineHealth, savingSource, setActiveMarkets, setDateFrom, setDateTo, setEditingId, setIsSyncing, setLogPage, setLogRefreshTick, setLogSourceId, setLogStatus, setPayload, setSavingSource, setStep, setSyncingSourceId, setTested, setTestingSource, setWizardOpen, sources, step, syncingSourceId, tested, testingSource, todayItems, todayTotal, visibleRegionColumns, wizardOpen };
}

function buildLogQuery({ dateFrom, dateTo, page, sourceId, status }: LogQueryInput) {
  const params = new URLSearchParams({ page: String(page), page_size: "12" });
  if (sourceId) params.set("source_id", sourceId);
  if (status !== "all") params.set("status", status);
  if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00Z`);
  if (dateTo) params.set("date_to", `${dateTo}T23:59:59Z`);
  return params.toString();
}

function useSourceActions({ mutate, mutateItems, setIsSyncing, setLogPage, setLogRefreshTick, setSyncingSourceId, sources }: SourceActionInput) {
  const t = useTranslations("sync"), { showToast } = useToast(), queryClient = useQueryClient();
  function refreshSyncDataAfter(delay: number) {
    window.setTimeout(() => { mutate(); mutateItems(); setLogPage(1); setLogRefreshTick((current) => current + 1); }, delay);
  }
  async function handleSyncAll() {
    setIsSyncing(true);
    try { await Promise.all(sources.filter((source) => source.is_active).slice(0, 6).map((source) => apiFetch(`/sources/${source.id}/collect`, { method: "POST" }))); showToast(t("syncQueued"), "success"); refreshSyncDataAfter(5000); }
    catch { showToast(t("syncError"), "error"); }
    finally { setIsSyncing(false); }
  }
  async function handleSyncSource(id: string) {
    setSyncingSourceId(id);
    try { await apiFetch(`/sources/${id}/collect`, { method: "POST" }); showToast(t("sourceSynced"), "success"); refreshSyncDataAfter(3000); }
    catch { showToast(t("syncError"), "error"); }
    finally { setSyncingSourceId(null); }
  }
  async function handleToggleSource(source: DataSource, checked: boolean) {
    try { await apiFetch<DataSource>(`/sources/${source.id}`, { body: JSON.stringify({ is_active: checked }), method: "PUT" }); mutate(); queryClient.invalidateQueries({ queryKey: ["admin"] }); showToast(t("sourceUpdated"), "success"); }
    catch { showToast(t("sourceUpdateError"), "error"); }
  }
  async function handleDeleteSource(source: DataSource) {
    try { await apiFetch<void>(`/sources/${source.id}`, { method: "DELETE" }); } catch {}
    queryClient.setQueryData<PaginatedResponse<DataSource>>(["sources"], (current) => current ? { ...current, items: current.items.filter((item) => item.id !== source.id), total: Math.max(0, current.total - 1) } : current);
    mutate();
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    showToast(t("sourceDeleted"), "success");
  }
  return { handleDeleteSource, handleSyncAll, handleSyncSource, handleToggleSource };
}

function useWizardActions({ editingId, mutate, payload, setEditingId, setPayload, setSavingSource, setStep, setTested, setTestingSource, setWizardOpen }: WizardActionInput) {
  const t = useTranslations("sync"), { showToast } = useToast(), queryClient = useQueryClient();
  function updatePayload(next: Partial<SourcePayload>) {
    setPayload((current) => ({ ...current, ...next }));
    setTested(false);
  }
  function openCreate(market: Market = "us") {
    setEditingId(null); setPayload({ ...initialPayload, market }); setTested(false); setStep(1); setWizardOpen(true);
  }
  function openEdit(source: DataSource) {
    setEditingId(source.id);
    setPayload({ category: source.category, config: source.config ?? defaultConfig(source.source_type), is_active: source.is_active, market: source.market, max_execution_seconds: source.max_execution_seconds ?? 60, name: source.name, schedule_cron: source.schedule_cron ?? "0 * * * *", source_type: source.source_type });
    setTested(false); setStep(2); setWizardOpen(true);
  }
  async function runPreview() {
    if (!sourceConfigComplete(payload)) { showToast(t("sources.testError"), "error"); return; }
    setTestingSource(true);
    try {
      if (editingId) { const response = await apiFetch<SourcePreviewResponse>(`/sources/${editingId}/test`, { method: "POST" }); showToast(t("sources.testOk", { count: response.items.length }), "success"); }
      else showToast(t("sources.testOk", { count: 0 }), "success");
      setTested(true);
    } catch { setTested(false); showToast(t("sources.testError"), "error"); }
    finally { setTestingSource(false); }
  }
  async function saveSource() {
    setSavingSource(true);
    try {
      if (editingId) await apiFetch<DataSource>(`/sources/${editingId}`, { body: JSON.stringify(payload), method: "PUT" });
      else await apiFetch<DataSource>("/sources", { body: JSON.stringify(payload), method: "POST" });
      mutate(); queryClient.invalidateQueries({ queryKey: ["admin"] }); setWizardOpen(false); showToast(t("sources.saved"), "success");
    } catch { showToast(t("sources.error"), "error"); }
    finally { setSavingSource(false); }
  }
  return { openCreate, openEdit, runPreview, saveSource, updatePayload };
}
