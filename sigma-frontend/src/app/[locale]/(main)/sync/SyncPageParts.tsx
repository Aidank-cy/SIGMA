"use client";

import { motion } from "framer-motion";
import { Activity, CheckCircle2, Database, FileClock, Play, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/dashboard/custom-select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { toggleMultiSelection } from "@/lib/selection";
import { cn } from "@/lib/utils";
import type { Category, DataSource, Market, SourcePayload } from "@/lib/types";
import type { AdminLogResponse } from "@/hooks/useAdmin";

import { categories, defaultConfig, formatRelative, friendlyError, marketFilters, markets, sourceIcon, sourceTypes, statuses, type LogFilter } from "./SyncPageUtils";

export function SyncHeader({ handleSyncAll, isSyncing, lastLogDate, sourcesLength }: { handleSyncAll: () => void; isSyncing: boolean; lastLogDate?: string; sourcesLength: number }) {
  const t = useTranslations("sync"), locale = useLocale();
  return (
    <motion.div animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" initial={{ opacity: 0, y: 20 }}>
      <div><h1 className="text-[32px] font-bold text-foreground">{t("title")}</h1><p className="text-sm text-foreground/60">{t("subtitle")}</p></div>
      <div className="flex items-center gap-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-chart-1" /></span>{t("lastSynced")}: <span className="font-bold text-foreground">{lastLogDate ? formatRelative(lastLogDate, locale) : t("unknown")}</span></div><motion.button className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50" disabled={isSyncing || sourcesLength === 0} onClick={handleSyncAll} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />{t("syncAll")}</motion.button></div>
    </motion.div>
  );
}

export function SyncStatusCards({ activeSources, pipelineHealth, sourcesLength, todayTotal }: { activeSources: number; pipelineHealth: number; sourcesLength: number; todayTotal: number }) {
  const t = useTranslations("sync");
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatusCard icon={Database} label={t("activeSources")} value={String(activeSources)} detail={t("ofTotal", { total: sourcesLength })}><div className="relative h-12 w-12 shrink-0"><svg className="h-12 w-12 -rotate-90"><circle className="text-muted/30" cx="24" cy="24" fill="none" r="20" stroke="currentColor" strokeWidth="5" /><circle className="text-chart-1" cx="24" cy="24" fill="none" r="20" stroke="currentColor" strokeDasharray={`${sourcesLength === 0 ? 0 : (activeSources / sourcesLength) * 126} 126`} strokeLinecap="round" strokeWidth="5" /></svg><div className="absolute inset-0 flex items-center justify-center"><Database className="h-4 w-4 text-muted-foreground" /></div></div></StatusCard>
      <StatusCard icon={Activity} label={t("todayCollections")} value={String(todayTotal)} detail={t("collectedToday")} />
      <StatusCard icon={Zap} label={t("pipelineHealth")} value={`${pipelineHealth}%`} detail={t("activeRatio")} />
    </div>
  );
}

function StatusCard({ children, detail, icon: Icon, label, value }: { children?: ReactNode; detail: string; icon: LucideIcon; label: string; value: string }) {
  return <motion.div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md" whileHover={{ y: -2 }}><div className="flex items-center gap-4">{children ?? <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-chart-1/10"><Icon className="h-6 w-6 text-chart-1" /></div>}<div className="min-w-0 flex-1"><p className="text-[13px] text-muted-foreground">{label}</p><div className="flex items-baseline gap-2"><span className="text-[28px] font-bold leading-tight text-foreground">{value}</span><span className="text-[13px] text-muted-foreground">{detail}</span></div></div></div></motion.div>;
}

export function SourcesSection({ activeMarkets, groupedSources, handleDeleteSource, handleSyncSource, handleToggleSource, isLoading, openCreate, openEdit, setActiveMarkets, showSourceLogs, syncingSourceId, visibleRegionColumns }: { activeMarkets: Market[]; groupedSources: Record<Market, DataSource[]>; handleDeleteSource: (source: DataSource) => void; handleSyncSource: (id: string) => void; handleToggleSource: (source: DataSource, checked: boolean) => void; isLoading: boolean; openCreate: (market?: Market) => void; openEdit: (source: DataSource) => void; setActiveMarkets: (value: (current: Market[]) => Market[]) => void; showSourceLogs: (source: DataSource) => void; syncingSourceId: string | null; visibleRegionColumns: Market[] }) {
  const t = useTranslations("sync"), marketT = useTranslations("markets");
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><h2 className="text-lg font-bold text-foreground">{t("dataSources")}</h2><div className="flex flex-wrap gap-2 lg:justify-end">{marketFilters.map((market) => <motion.button className={cn("rounded-2xl px-4 py-2 text-sm font-bold transition-all duration-200", (market === "" && activeMarkets.length === 0) || (market !== "" && activeMarkets.includes(market)) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground")} key={market || "all-markets"} onClick={() => setActiveMarkets((current) => toggleMultiSelection(current, market, marketFilters.filter((item) => item !== "").length))} type="button" whileTap={{ scale: 0.95 }}>{market ? marketT(`regionNames.${market}`) : t("markets.all")}</motion.button>)}</div></div>
      {isLoading ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 6 }).map((_, index) => <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" key={index} />)}</div> : <SourceRegionGrid groupedSources={groupedSources} handleDeleteSource={handleDeleteSource} handleSyncSource={handleSyncSource} handleToggleSource={handleToggleSource} openCreate={openCreate} openEdit={openEdit} showSourceLogs={showSourceLogs} syncingSourceId={syncingSourceId} visibleRegionColumns={visibleRegionColumns} />}
    </section>
  );
}

function SourceRegionGrid({ groupedSources, handleDeleteSource, handleSyncSource, handleToggleSource, openCreate, openEdit, showSourceLogs, syncingSourceId, visibleRegionColumns }: { groupedSources: Record<Market, DataSource[]>; handleDeleteSource: (source: DataSource) => void; handleSyncSource: (id: string) => void; handleToggleSource: (source: DataSource, checked: boolean) => void; openCreate: (market?: Market) => void; openEdit: (source: DataSource) => void; showSourceLogs: (source: DataSource) => void; syncingSourceId: string | null; visibleRegionColumns: Market[] }) {
  const t = useTranslations("sync"), marketT = useTranslations("markets");
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {visibleRegionColumns.map((market) => {
        const marketSources = groupedSources[market];
        return <section className="flex h-[26rem] flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30" key={market}><div className="mb-4 flex shrink-0 items-start justify-between gap-4"><div><h3 className="font-bold text-foreground">{marketT(`regionNames.${market}`)}</h3><p className="mt-1 text-xs text-muted-foreground">{t("sources.sourceCount", { count: marketSources.length })}</p></div><span className="rounded-2xl bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">{market.toUpperCase()}</span></div><div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{marketSources.map((source) => <SourceRow isSyncing={syncingSourceId === source.id} key={source.id} onDelete={() => handleDeleteSource(source)} onEdit={() => openEdit(source)} onLogs={() => showSourceLogs(source)} onSync={() => handleSyncSource(source.id)} onToggle={(checked) => handleToggleSource(source, checked)} source={source} />)}{marketSources.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-6 text-center"><p className="text-sm text-muted-foreground">{t("sources.emptyRegion")}</p></div> : null}</div><div className="mt-4 flex shrink-0 justify-end border-t border-border pt-3"><Button onClick={() => openCreate(market)} size="sm" variant="secondary"><Plus className="h-4 w-4" aria-hidden />{t("sources.add")}</Button></div></section>;
      })}
    </div>
  );
}

function SourceRow({ isSyncing, onDelete, onEdit, onLogs, onSync, onToggle, source }: { isSyncing: boolean; onDelete: () => void; onEdit: () => void; onLogs: () => void; onSync: () => void; onToggle: (checked: boolean) => void; source: DataSource }) {
  const t = useTranslations("sync");
  const Icon = sourceIcon(source.source_type);
  return <div className="flex h-14 items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-3 py-2"><button className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-primary" onClick={onEdit} type="button"><Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><span className="min-w-0"><span className="block truncate text-sm font-bold text-foreground">{source.name}</span><span className="block truncate text-xs text-muted-foreground">{t(`sources.types.${source.source_type}`)}</span></span></button><div className="flex shrink-0 items-center gap-1"><ToggleSwitch checked={source.is_active} label={t("sources.toggleSource", { name: source.name })} onChange={onToggle} /><IconButton disabled={isSyncing} label={t("sources.syncSource", { name: source.name })} onClick={onSync}><RefreshCw className={cn("h-4 w-4", isSyncing ? "animate-spin" : "")} aria-hidden /></IconButton><IconButton label={t("sources.logs")} onClick={onLogs}><FileClock className="h-4 w-4" aria-hidden /></IconButton>{!source.is_system ? <IconButton label={t("sources.delete")} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden /></IconButton> : null}</div></div>;
}

export function UserLogsPanel({ dateFrom, dateTo, logs, onDateFromChange, onDateToChange, onPageChange, onSourceChange, onStatusChange, page, sourceId, sources, status }: { dateFrom: string; dateTo: string; logs: AdminLogResponse | null; onDateFromChange: (value: string) => void; onDateToChange: (value: string) => void; onPageChange: (value: number | ((current: number) => number)) => void; onSourceChange: (value: string) => void; onStatusChange: (value: LogFilter) => void; page: number; sourceId: string; sources: DataSource[]; status: LogFilter }) {
  const syncT = useTranslations("sync");
  return <section className="space-y-6"><div><p className="text-sm font-bold uppercase tracking-normal text-muted-foreground">{syncT("logsEyebrow")}</p><h2 className="mt-2 text-[24px] font-bold text-foreground">{syncT("logsTitle")}</h2></div><LogFilters dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={onDateFromChange} onDateToChange={onDateToChange} onSourceChange={onSourceChange} onStatusChange={onStatusChange} sourceId={sourceId} sources={sources} status={status} /><LogList logs={logs} /><LogFooter logs={logs} onPageChange={onPageChange} page={page} /></section>;
}

function LogFilters({ dateFrom, dateTo, onDateFromChange, onDateToChange, onSourceChange, onStatusChange, sourceId, sources, status }: { dateFrom: string; dateTo: string; onDateFromChange: (value: string) => void; onDateToChange: (value: string) => void; onSourceChange: (value: string) => void; onStatusChange: (value: LogFilter) => void; sourceId: string; sources: DataSource[]; status: LogFilter }) {
  const t = useTranslations("sync.logs"), statusT = useTranslations("sync.logStatus");
  const today = new Date().toISOString().split("T")[0], oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  return <div className="rounded-2xl border border-border bg-card p-6"><div className="grid items-end gap-3 md:grid-cols-4"><CustomSelect label={t("source")} onChange={onSourceChange} options={[{ label: t("allSources"), value: "" }, ...sources.map((source) => ({ label: source.name, value: source.id }))]} selectClassName="rounded-xl" value={sourceId} /><CustomSelect label={t("status")} onChange={(value) => onStatusChange(value as LogFilter)} options={statuses.map((item) => ({ label: item === "all" ? t("allStatuses") : statusT(item), value: item }))} selectClassName="rounded-xl" value={status} /><DateField label={t("from")} max={today} min={oneYearAgo} onChange={onDateFromChange} value={dateFrom} /><DateField label={t("to")} max={today} min={dateFrom || oneYearAgo} onChange={onDateToChange} value={dateTo} /></div></div>;
}

function LogList({ logs }: { logs: AdminLogResponse | null }) {
  const t = useTranslations("sync.logs"), statusT = useTranslations("sync.logStatus");
  return <div className="space-y-3">{(logs?.items ?? []).map((log) => <div className={cn("rounded-xl border border-border border-l-4 bg-card p-4", log.status === "success" ? "border-l-chart-1" : "", log.status === "fail" ? "border-l-chart-2" : "", log.status === "timeout" ? "border-l-chart-4" : "")} key={log.id}><div className="flex items-center gap-2"><p className="font-bold text-foreground">{log.source_name}</p><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{statusT(log.status)}</span></div><p className="mt-1 text-sm text-muted-foreground">{log.items_count} {t("items")} · {new Date(log.executed_at).toLocaleString()} · {log.duration_ms} ms</p>{log.status !== "success" ? <p className="mt-1 text-sm text-destructive">{friendlyError(log.error_message)}</p> : null}</div>)}{logs !== null && (logs.items ?? []).length === 0 ? <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{t("empty")}</div> : null}</div>;
}

function LogFooter({ logs, onPageChange, page }: { logs: AdminLogResponse | null; onPageChange: (value: number | ((current: number) => number)) => void; page: number }) {
  const t = useTranslations("sync.logs");
  return <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{t("footer", { rate: Math.round((logs?.success_rate ?? 0) * 100), total: logs?.total ?? 0 })}</p><div className="flex gap-2"><Button disabled={page === 1} onClick={() => onPageChange((current) => current - 1)} size="sm" variant="ghost">{t("previous")}</Button><Button disabled={!logs?.has_next} onClick={() => onPageChange((current) => current + 1)} size="sm">{t("next")}</Button></div></footer>;
}

export function SourceWizardModal({ editingId, nextRun, payload, runPreview, saveSource, savingSource, setStep, setWizardOpen, step, tested, testingSource, updatePayload, wizardOpen }: { editingId: string | null; nextRun: string; payload: SourcePayload; runPreview: () => void; saveSource: () => void; savingSource: boolean; setStep: (value: number | ((current: number) => number)) => void; setWizardOpen: (open: boolean) => void; step: number; tested: boolean; testingSource: boolean; updatePayload: (payload: Partial<SourcePayload>) => void; wizardOpen: boolean }) {
  const t = useTranslations("sync");
  return <Modal closeLabel={t("nav.close")} isOpen={wizardOpen} onClose={() => setWizardOpen(false)} title={editingId ? t("sources.editTitle") : t("sources.addTitle")}><div className="space-y-4"><StepIndicator step={step} />{step === 1 ? <SourceTypeStep payload={payload} setStep={setStep} updatePayload={updatePayload} /> : null}{step === 2 ? <ConfigStep payload={payload} setPayload={updatePayload} /> : null}{step === 3 ? <MetadataStep nextRun={nextRun} payload={payload} setPayload={updatePayload} /> : null}{step === 4 ? <PreviewStep runPreview={runPreview} tested={tested} testingSource={testingSource} /> : null}<WizardFooter payload={payload} saveSource={saveSource} savingSource={savingSource} setStep={setStep} step={step} tested={tested} /></div></Modal>;
}

function SourceTypeStep({ payload, setStep, updatePayload }: { payload: SourcePayload; setStep: (value: number) => void; updatePayload: (payload: Partial<SourcePayload>) => void }) {
  const t = useTranslations("sync");
  return <div className="grid gap-3 sm:grid-cols-3">{sourceTypes.map((type) => <button className={cn("rounded-2xl border p-6 text-left text-sm font-bold", payload.source_type === type ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary")} key={type} onClick={() => { updatePayload({ config: defaultConfig(type), source_type: type }); setStep(2); }} type="button">{t(`sources.types.${type}`)}</button>)}</div>;
}

function PreviewStep({ runPreview, tested, testingSource }: { runPreview: () => void; tested: boolean; testingSource: boolean }) {
  const t = useTranslations("sync");
  return <div className="space-y-4"><Button isLoading={testingSource} onClick={runPreview} variant="secondary"><Play className="h-4 w-4" aria-hidden />{t("sources.runTest")}</Button>{tested ? <p className="flex items-center gap-2 text-sm font-bold text-chart-1"><CheckCircle2 className="h-4 w-4" aria-hidden />{t("sources.tested")}</p> : null}</div>;
}

function WizardFooter({ payload, saveSource, savingSource, setStep, step, tested }: { payload: SourcePayload; saveSource: () => void; savingSource: boolean; setStep: (value: number | ((current: number) => number)) => void; step: number; tested: boolean }) {
  const t = useTranslations("sync");
  return <div className="flex justify-between gap-2"><Button disabled={step === 1} onClick={() => setStep((current) => current - 1)} variant="ghost">{t("sources.back")}</Button>{step === 1 ? null : step < 4 ? <Button disabled={!payload.name && step > 1} onClick={() => setStep((current) => current + 1)}>{t("sources.next")}</Button> : <Button disabled={!tested} isLoading={savingSource} onClick={saveSource}>{t("sources.save")}</Button>}</div>;
}

function ConfigStep({ payload, setPayload }: { payload: SourcePayload; setPayload: (payload: Partial<SourcePayload>) => void }) {
  const t = useTranslations("sync");
  const setConfig = (key: string, value: string) => setPayload({ config: { ...payload.config, [key]: value } });
  const nameHintKey = payload.source_type === "api" ? "sources.hints.apiName" : payload.source_type === "scraper" ? "sources.hints.scraperName" : "sources.hints.rssName";
  return <div className="space-y-4"><div><Input label={t("sources.name")} onChange={(event) => setPayload({ name: event.target.value })} value={payload.name} /><p className="mt-1 text-xs text-muted-foreground">{t(nameHintKey)}</p></div>{payload.source_type === "rss" ? <div><Input label={t("sources.fields.feedUrl")} onChange={(event) => setConfig("feed_url", event.target.value)} value={String(payload.config.feed_url ?? "")} /><p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.feedUrl")}</p></div> : null}{payload.source_type === "api" ? <><div><Input label={t("sources.fields.endpoint")} onChange={(event) => setConfig("endpoint", event.target.value)} value={String(payload.config.endpoint ?? "")} /><p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.endpoint")}</p></div><div><Input label={t("sources.fields.itemsPath")} onChange={(event) => setConfig("items_path", event.target.value)} value={String(payload.config.items_path ?? "")} /><p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.itemsPath")}</p></div></> : null}{payload.source_type === "scraper" ? <><div><Input label={t("sources.fields.url")} onChange={(event) => setConfig("url", event.target.value)} value={String(payload.config.url ?? "")} /><p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.url")}</p></div><div><Input label={t("sources.fields.selector")} onChange={(event) => setConfig("item_selector", event.target.value)} value={String(payload.config.item_selector ?? "")} /><p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.selector")}</p></div></> : null}</div>;
}

function MetadataStep({ nextRun, payload, setPayload }: { nextRun: string; payload: SourcePayload; setPayload: (payload: Partial<SourcePayload>) => void }) {
  const t = useTranslations("sync");
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><CustomSelect label={t("sources.category")} onChange={(value) => setPayload({ category: value as Category })} options={categories.map((category) => ({ label: t(`sources.categories.${category}`), value: category }))} value={payload.category} /><CustomSelect label={t("sources.market")} onChange={(value) => setPayload({ market: value as Market })} options={markets.map((market) => ({ label: t(`sources.markets.${market}`), value: market }))} value={payload.market} /></div><Input label={t("sources.cron")} onChange={(event) => setPayload({ schedule_cron: event.target.value })} value={payload.schedule_cron} /><Input label={t("sources.timeout")} min={1} onChange={(event) => setPayload({ max_execution_seconds: Number(event.target.value) })} type="number" value={payload.max_execution_seconds} /><p className="text-sm text-muted-foreground">{t("sources.nextRun", { time: nextRun })}</p></div>;
}

function StepIndicator({ step }: { step: number }) {
  const t = useTranslations("sync");
  return <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map((item) => <div className={cn("h-1.5 rounded-full", item <= step ? "bg-primary" : "bg-border")} key={item} title={t(`sources.steps.${item}`)} />)}</div>;
}

function IconButton({ children, disabled = false, label, onClick }: { children: ReactNode; disabled?: boolean; label: string; onClick: () => void }) {
  return <button aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={onClick} title={label} type="button">{children}</button>;
}

function DateField({ label, max, min, onChange, value }: { label: string; max: string; min: string; onChange: (value: string) => void; value: string }) {
  return <Input className="cursor-pointer rounded-xl bg-card" label={label} max={max} min={min} onChange={(event) => onChange(event.target.value)} onClick={(event) => event.currentTarget.showPicker?.()} type="date" value={value} />;
}
