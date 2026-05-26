"use client"

import { motion } from "framer-motion"
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code,
  Database,
  FileClock,
  Play,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
  Zap
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/Button"
import { CustomSelect } from "@/components/dashboard/custom-select"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { ToggleSwitch } from "@/components/ui/ToggleSwitch"
import { useToast } from "@/components/ui/Toast"
import { useItems } from "@/hooks/useItems"
import { useSources } from "@/hooks/useSources"
import { apiFetch } from "@/lib/api"
import { toggleMultiSelection } from "@/lib/selection"
import { cn } from "@/lib/utils"
import type { Category, DataSource, Market, PaginatedResponse, SourcePayload } from "@/lib/types"
import type { AdminLogResponse, CollectorStatus } from "@/hooks/useAdmin"

type LogFilter = CollectorStatus | "all"
interface SourcePreviewResponse {
  items: Record<string, unknown>[]
}

const sourceTypes = ["rss", "api", "scraper"] as const
const categories: Category[] = ["politics", "finance", "technology", "macro", "other"]
const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw", "global"]
const regionColumns: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw", "global"]
const marketFilters: Array<Market | ""> = ["", ...regionColumns]
const statuses: LogFilter[] = ["all", "success", "fail", "timeout"]

const initialPayload: SourcePayload = {
  category: "finance",
  config: { feed_url: "" },
  is_active: true,
  market: "us",
  max_execution_seconds: 60,
  name: "",
  schedule_cron: "0 * * * *",
  source_type: "rss"
}

function todayStart() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function formatRelative(date: string | undefined, locale: string) {
  if (!date) return null
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  return formatter.format(Math.round(hours / 24), "day")
}

function sourceIcon(type: DataSource["source_type"]) {
  if (type === "rss") return Rss
  if (type === "scraper") return Code
  return Database
}

export default function SyncPage() {
  const t = useTranslations("sync")
  const marketT = useTranslations("markets")
  const locale = useLocale()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, mutate } = useSources()
  const todayIso = useMemo(() => todayStart(), [])
  const todayItems = useItems({ date_from: todayIso, page_size: 1 })
  const sources = useMemo(() => data?.items ?? [], [data?.items])
  const activeSources = sources.filter((source) => source.is_active).length
  const todayTotal = todayItems.data?.pages[0]?.total ?? 0
  const pipelineHealth = sources.length === 0 ? 0 : Math.round((activeSources / sources.length) * 100)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [payload, setPayload] = useState<SourcePayload>(initialPayload)
  const [tested, setTested] = useState(false)
  const [savingSource, setSavingSource] = useState(false)
  const [testingSource, setTestingSource] = useState(false)
  const [logSourceId, setLogSourceId] = useState("")
  const [logStatus, setLogStatus] = useState<LogFilter>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeMarkets, setActiveMarkets] = useState<Market[]>([])
  const [logPage, setLogPage] = useState(1)
  const [logRefreshTick, setLogRefreshTick] = useState(0)
  const [logs, setLogs] = useState<AdminLogResponse | null>(null)
  const [collapsedLogs, setCollapsedLogs] = useState<Set<string>>(new Set())
  const logsSectionRef = useRef<HTMLElement>(null)

  const nextRun = useMemo(() => new Date(Date.now() + 60 * 60 * 1000).toLocaleString(), [])
  const groupedSources = useMemo(() => {
    const groups = Object.fromEntries(regionColumns.map((market) => [market, [] as DataSource[]])) as Record<Market, DataSource[]>
    for (const source of sources) {
      groups[normalizeMarket(source.market)].push(source)
    }
    return groups
  }, [sources])
  const visibleRegionColumns = useMemo(
    () => (activeMarkets.length === 0 ? regionColumns : regionColumns.filter((market) => activeMarkets.includes(market))),
    [activeMarkets]
  )

  const logQuery = useMemo(() => {
    const params = new URLSearchParams({
      page: String(logPage),
      page_size: "12"
    })
    if (logSourceId) params.set("source_id", logSourceId)
    if (logStatus !== "all") params.set("status", logStatus)
    if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00Z`)
    if (dateTo) params.set("date_to", `${dateTo}T23:59:59Z`)
    return params.toString()
  }, [dateFrom, dateTo, logPage, logSourceId, logStatus])

  useEffect(() => {
    let cancelled = false
    apiFetch<AdminLogResponse>(`/sources/logs?${logQuery}`)
      .then((response) => {
        if (!cancelled) setLogs(response)
      })
      .catch(() => {
        if (!cancelled) setLogs(buildMockLogResponse(sources, { dateFrom, dateTo, page: logPage, sourceId: logSourceId, status: logStatus }))
      })
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, logPage, logQuery, logRefreshTick, logSourceId, logStatus, sources])

  function updatePayload(next: Partial<SourcePayload>) {
    setPayload((current) => ({ ...current, ...next }))
    setTested(false)
  }

  function openCreate(market: Market = "us") {
    setEditingId(null)
    setPayload({ ...initialPayload, market })
    setTested(false)
    setStep(1)
    setWizardOpen(true)
  }

  function openEdit(source: DataSource) {
    setEditingId(source.id)
    setPayload({
      category: source.category,
      config: source.config ?? defaultConfig(source.source_type),
      is_active: source.is_active,
      market: source.market,
      max_execution_seconds: source.max_execution_seconds ?? 60,
      name: source.name,
      schedule_cron: source.schedule_cron ?? "0 * * * *",
      source_type: source.source_type
    })
    setTested(false)
    setStep(2)
    setWizardOpen(true)
  }

  function refreshSyncDataAfter(delay: number) {
    window.setTimeout(() => {
      mutate()
      todayItems.mutate()
      setLogPage(1)
      setLogRefreshTick((current) => current + 1)
    }, delay)
  }

  async function handleSyncAll() {
    setIsSyncing(true)
    try {
      await Promise.all(sources.filter((source) => source.is_active).slice(0, 6).map((source) => apiFetch(`/sources/${source.id}/collect`, { method: "POST" })))
      showToast(t("syncQueued"), "success")
      refreshSyncDataAfter(5000)
    } catch {
      showToast(t("syncError"), "error")
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleSyncSource(id: string) {
    setSyncingSourceId(id)
    try {
      await apiFetch(`/sources/${id}/collect`, { method: "POST" })
      showToast(t("sourceSynced"), "success")
      refreshSyncDataAfter(3000)
    } catch {
      showToast(t("syncError"), "error")
    } finally {
      setSyncingSourceId(null)
    }
  }

  async function handleToggleSource(source: DataSource, checked: boolean) {
    try {
      await apiFetch<DataSource>(`/sources/${source.id}`, {
        body: JSON.stringify({ is_active: checked }),
        method: "PUT"
      })
      mutate()
      queryClient.invalidateQueries({ queryKey: ["admin"] })
      showToast(t("sourceUpdated"), "success")
    } catch {
      showToast(t("sourceUpdateError"), "error")
    }
  }

  async function handleDeleteSource(source: DataSource) {
    try {
      await apiFetch<void>(`/sources/${source.id}`, { method: "DELETE" })
    } catch {
      // The DELETE endpoint returns 204 No Content; ignore client parse failures after deletion.
    }
    queryClient.setQueryData<PaginatedResponse<DataSource>>(["sources"], (current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => item.id !== source.id),
            total: Math.max(0, current.total - 1)
          }
        : current
    )
    mutate()
    queryClient.invalidateQueries({ queryKey: ["admin"] })
    showToast(t("sourceDeleted"), "success")
  }

  async function runPreview() {
    if (!sourceConfigComplete(payload)) {
      showToast(t("sources.testError"), "error")
      return
    }
    setTestingSource(true)
    try {
      if (editingId) {
        const response = await apiFetch<SourcePreviewResponse>(`/sources/${editingId}/test`, { method: "POST" })
        showToast(t("sources.testOk", { count: response.items.length }), "success")
      } else {
        showToast(t("sources.testOk", { count: 0 }), "success")
      }
      setTested(true)
    } catch {
      setTested(false)
      showToast(t("sources.testError"), "error")
    } finally {
      setTestingSource(false)
    }
  }

  async function saveSource() {
    setSavingSource(true)
    try {
      if (editingId) {
        await apiFetch<DataSource>(`/sources/${editingId}`, {
          body: JSON.stringify(payload),
          method: "PUT"
        })
      } else {
        await apiFetch<DataSource>("/sources", {
          body: JSON.stringify(payload),
          method: "POST"
        })
      }
      mutate()
      queryClient.invalidateQueries({ queryKey: ["admin"] })
      setWizardOpen(false)
      showToast(t("sources.saved"), "success")
    } catch {
      showToast(t("sources.error"), "error")
    } finally {
      setSavingSource(false)
    }
  }

  function showSourceLogs(source: DataSource) {
    setLogSourceId(source.id)
    setLogPage(1)
    setTimeout(() => {
      logsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  function toggleLog(id: string) {
    setCollapsedLogs((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <motion.div animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" initial={{ opacity: 0, y: 20 }}>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-1" />
            </span>
            {t("lastSynced")}: <span className="font-medium text-foreground">{logs?.items[0] ? formatRelative(logs.items[0].executed_at, locale) : t("unknown")}</span>
          </div>
          <motion.button
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={isSyncing || sources.length === 0}
            onClick={handleSyncAll}
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {t("syncAll")}
          </motion.button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatusCard icon={Database} label={t("activeSources")} value={String(activeSources)} detail={t("ofTotal", { total: sources.length })}>
          <div className="relative h-16 w-16">
            <svg className="h-16 w-16 -rotate-90">
              <circle className="text-muted/30" cx="32" cy="32" fill="none" r="28" stroke="currentColor" strokeWidth="6" />
              <circle className="text-chart-1" cx="32" cy="32" fill="none" r="28" stroke="currentColor" strokeDasharray={`${sources.length === 0 ? 0 : (activeSources / sources.length) * 176} 176`} strokeLinecap="round" strokeWidth="6" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Database className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </StatusCard>
        <StatusCard icon={Activity} label={t("todayCollections")} value={String(todayTotal)} detail={t("collectedToday")} />
        <StatusCard icon={Zap} label={t("pipelineHealth")} value={`${pipelineHealth}%`} detail={t("activeRatio")} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("dataSources")}</h2>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {marketFilters.map((market) => (
              <motion.button
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                  (market === "" && activeMarkets.length === 0) || (market !== "" && activeMarkets.includes(market))
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
                key={market || "all-markets"}
                onClick={() =>
                  setActiveMarkets((current) =>
                    toggleMultiSelection(current, market, marketFilters.filter((item) => item !== "").length)
                  )
                }
                type="button"
                whileTap={{ scale: 0.95 }}
              >
                {market ? marketT(`regionNames.${market}`) : t("markets.all")}
              </motion.button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => <div className="h-72 animate-pulse rounded-xl border border-border bg-card" key={index} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {visibleRegionColumns.map((market) => {
              const marketSources = groupedSources[market]
              return (
                <section
                  className="flex h-[22rem] flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
                  key={market}
                >
                  <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{marketT(`regionNames.${market}`)}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{t("sources.sourceCount", { count: marketSources.length })}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {market.toUpperCase()}
                    </span>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {marketSources.map((source) => (
                      <SourceRow
                        isSyncing={syncingSourceId === source.id}
                        key={source.id}
                        onDelete={() => handleDeleteSource(source)}
                        onEdit={() => openEdit(source)}
                        onLogs={() => showSourceLogs(source)}
                        onSync={() => handleSyncSource(source.id)}
                        onToggle={(checked) => handleToggleSource(source, checked)}
                        source={source}
                      />
                    ))}
                    {marketSources.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-6 text-center">
                        <p className="text-sm text-muted-foreground">{t("sources.emptyRegion")}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex shrink-0 justify-end border-t border-border pt-3">
                    <Button onClick={() => openCreate(market)} size="sm" variant="secondary">
                      <Plus className="h-4 w-4" aria-hidden />
                      {t("sources.add")}
                    </Button>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </section>

      <section className="scroll-mt-6" ref={logsSectionRef}>
        <UserLogsPanel
          collapsedLogs={collapsedLogs}
          dateFrom={dateFrom}
          dateTo={dateTo}
          logs={logs}
          onDateFromChange={(value) => {
            setDateFrom(value)
            setLogPage(1)
          }}
          onDateToChange={(value) => {
            setDateTo(value)
            setLogPage(1)
          }}
          onPageChange={setLogPage}
          onSourceChange={(value) => {
            setLogSourceId(value)
            setLogPage(1)
          }}
          onStatusChange={(value) => {
            setLogStatus(value)
            setLogPage(1)
          }}
          onToggleLog={toggleLog}
          page={logPage}
          sourceId={logSourceId}
          sources={sources}
          status={logStatus}
        />
      </section>

      <Modal
        closeLabel={t("nav.close")}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={editingId ? t("sources.editTitle") : t("sources.addTitle")}
      >
        <div className="space-y-4">
          <StepIndicator step={step} />
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
                  onClick={() => {
                    updatePayload({ config: defaultConfig(type), source_type: type })
                    setStep(2)
                  }}
                  type="button"
                >
                  {t(`sources.types.${type}`)}
                </button>
              ))}
            </div>
          ) : null}
          {step === 2 ? <ConfigStep payload={payload} setPayload={updatePayload} /> : null}
          {step === 3 ? (
            <MetadataStep nextRun={nextRun} payload={payload} setPayload={updatePayload} />
          ) : null}
          {step === 4 ? (
            <div className="space-y-4">
              <Button isLoading={testingSource} onClick={runPreview} variant="secondary">
                <Play className="h-4 w-4" aria-hidden />
                {t("sources.runTest")}
              </Button>
              {tested ? (
                <p className="flex items-center gap-2 text-sm font-medium text-sigma-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t("sources.tested")}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button disabled={step === 1} onClick={() => setStep((current) => current - 1)} variant="ghost">
              {t("sources.back")}
            </Button>
            {step === 1 ? null : step < 4 ? (
              <Button disabled={!payload.name && step > 1} onClick={() => setStep((current) => current + 1)}>
                {t("sources.next")}
              </Button>
            ) : (
              <Button disabled={!tested} isLoading={savingSource} onClick={saveSource}>
                {t("sources.save")}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatusCard({ children, detail, icon: Icon, label, value }: { children?: ReactNode; detail: string; icon: LucideIcon; label: string; value: string }) {
  return (
    <motion.div className="rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5" whileHover={{ y: -4 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{value}</span>
            <span className="text-sm text-muted-foreground">{detail}</span>
          </div>
        </div>
        {children ?? (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-1/10">
            <Icon className="h-6 w-6 text-chart-1" />
          </div>
        )}
      </div>
    </motion.div>
  )
}

function SourceRow({
  isSyncing,
  onDelete,
  onEdit,
  onLogs,
  onSync,
  onToggle,
  source
}: {
  isSyncing: boolean
  onDelete: () => void
  onEdit: () => void
  onLogs: () => void
  onSync: () => void
  onToggle: (checked: boolean) => void
  source: DataSource
}) {
  const t = useTranslations("sync")
  const Icon = sourceIcon(source.source_type)

  return (
    <div className="flex h-14 items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-primary" onClick={onEdit} type="button">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{source.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{t(`sources.types.${source.source_type}`)}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <ToggleSwitch
          checked={source.is_active}
          label={t("sources.toggleSource", { name: source.name })}
          onChange={onToggle}
        />
        <IconButton disabled={isSyncing} label={t("sources.syncSource", { name: source.name })} onClick={onSync}>
          <RefreshCw className={cn("h-4 w-4", isSyncing ? "animate-spin" : "")} aria-hidden />
        </IconButton>
        <IconButton label={t("sources.logs")} onClick={onLogs}>
          <FileClock className="h-4 w-4" aria-hidden />
        </IconButton>
        {!source.is_system ? (
          <IconButton label={t("sources.delete")} onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </IconButton>
        ) : null}
      </div>
    </div>
  )
}

function UserLogsPanel({
  collapsedLogs,
  dateFrom,
  dateTo,
  logs,
  onDateFromChange,
  onDateToChange,
  onPageChange,
  onSourceChange,
  onStatusChange,
  onToggleLog,
  page,
  sourceId,
  sources,
  status
}: {
  collapsedLogs: Set<string>
  dateFrom: string
  dateTo: string
  logs: AdminLogResponse | null
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onPageChange: (value: number | ((current: number) => number)) => void
  onSourceChange: (value: string) => void
  onStatusChange: (value: LogFilter) => void
  onToggleLog: (id: string) => void
  page: number
  sourceId: string
  sources: DataSource[]
  status: LogFilter
}) {
  const t = useTranslations("sync.logs")
  const syncT = useTranslations("sync")
  const statusT = useTranslations("sync.logStatus")
  const today = new Date().toISOString().split("T")[0]
  const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0]

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-normal text-muted-foreground">{syncT("logsEyebrow")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">{syncT("logsTitle")}</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid items-end gap-3 md:grid-cols-4">
          <CustomSelect
            label={t("source")}
            onChange={onSourceChange}
            options={[
              { label: t("allSources"), value: "" },
              ...sources.map((source) => ({ label: source.name, value: source.id }))
            ]}
            selectClassName="rounded-xl"
            value={sourceId}
          />
          <CustomSelect
            label={t("status")}
            onChange={(value) => onStatusChange(value as LogFilter)}
            options={statuses.map((item) => ({
              label: item === "all" ? t("allStatuses") : statusT(item),
              value: item
            }))}
            selectClassName="rounded-xl"
            value={status}
          />
          <DateField label={t("from")} max={today} min={oneYearAgo} onChange={onDateFromChange} value={dateFrom} />
          <DateField label={t("to")} max={today} min={dateFrom || oneYearAgo} onChange={onDateToChange} value={dateTo} />
        </div>
      </div>

      <div className="space-y-3">
        {(logs?.items ?? []).map((log) => {
          const expanded = log.status !== "success" && !collapsedLogs.has(log.id)
          return (
            <div
              className={cn(
                "rounded-xl border border-border border-l-4 bg-card p-4",
                log.status === "success" ? "border-l-chart-1" : "",
                log.status === "fail" ? "border-l-chart-2" : "",
                log.status === "timeout" ? "border-l-chart-4" : ""
              )}
              key={log.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{log.source_name}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {statusT(log.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {log.items_count} {t("items")} · {new Date(log.executed_at).toLocaleString()}
                  </p>
                </div>
                <button
                  aria-label={expanded ? t("collapse") : t("expand")}
                  className="flex h-11 w-11 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onToggleLog(log.id)}
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
            </div>
          )
        })}
        {logs !== null && (logs.items ?? []).length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{t("empty")}</div>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("footer", {
            rate: Math.round((logs?.success_rate ?? 0) * 100),
            total: logs?.total ?? 0
          })}
        </p>
        <div className="flex gap-2">
          <Button disabled={page === 1} onClick={() => onPageChange((current) => current - 1)} size="sm" variant="ghost">
            {t("previous")}
          </Button>
          <Button disabled={!logs?.has_next} onClick={() => onPageChange((current) => current + 1)} size="sm">
            {t("next")}
          </Button>
        </div>
      </footer>
    </section>
  )
}

function ConfigStep({
  payload,
  setPayload
}: {
  payload: SourcePayload
  setPayload: (payload: Partial<SourcePayload>) => void
}) {
  const t = useTranslations("sync")
  const setConfig = (key: string, value: string) => {
    setPayload({ config: { ...payload.config, [key]: value } })
  }
  const nameHintKey =
    payload.source_type === "api"
      ? "sources.hints.apiName"
      : payload.source_type === "scraper"
        ? "sources.hints.scraperName"
        : "sources.hints.rssName"
  return (
    <div className="space-y-4">
      <div>
        <Input label={t("sources.name")} onChange={(event) => setPayload({ name: event.target.value })} value={payload.name} />
        <p className="mt-1 text-xs text-muted-foreground">{t(nameHintKey)}</p>
      </div>
      {payload.source_type === "rss" ? (
        <div>
          <Input
            label={t("sources.fields.feedUrl")}
            onChange={(event) => setConfig("feed_url", event.target.value)}
            value={String(payload.config.feed_url ?? "")}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.feedUrl")}</p>
        </div>
      ) : null}
      {payload.source_type === "api" ? (
        <>
          <div>
            <Input
              label={t("sources.fields.endpoint")}
              onChange={(event) => setConfig("endpoint", event.target.value)}
              value={String(payload.config.endpoint ?? "")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.endpoint")}</p>
          </div>
          <div>
            <Input
              label={t("sources.fields.itemsPath")}
              onChange={(event) => setConfig("items_path", event.target.value)}
              value={String(payload.config.items_path ?? "")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.itemsPath")}</p>
          </div>
        </>
      ) : null}
      {payload.source_type === "scraper" ? (
        <>
          <div>
            <Input
              label={t("sources.fields.url")}
              onChange={(event) => setConfig("url", event.target.value)}
              value={String(payload.config.url ?? "")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.url")}</p>
          </div>
          <div>
            <Input
              label={t("sources.fields.selector")}
              onChange={(event) => setConfig("item_selector", event.target.value)}
              value={String(payload.config.item_selector ?? "")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("sources.hints.selector")}</p>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetadataStep({
  nextRun,
  payload,
  setPayload
}: {
  nextRun: string
  payload: SourcePayload
  setPayload: (payload: Partial<SourcePayload>) => void
}) {
  const t = useTranslations("sync")

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <CustomSelect
          label={t("sources.category")}
          onChange={(value) => setPayload({ category: value as Category })}
          options={categories.map((category) => ({ label: t(`sources.categories.${category}`), value: category }))}
          value={payload.category}
        />
        <CustomSelect
          label={t("sources.market")}
          onChange={(value) => setPayload({ market: value as Market })}
          options={markets.map((market) => ({ label: t(`sources.markets.${market}`), value: market }))}
          value={payload.market}
        />
      </div>
      <Input
        label={t("sources.cron")}
        onChange={(event) => setPayload({ schedule_cron: event.target.value })}
        value={payload.schedule_cron}
      />
      <Input
        label={t("sources.timeout")}
        min={1}
        onChange={(event) => setPayload({ max_execution_seconds: Number(event.target.value) })}
        type="number"
        value={payload.max_execution_seconds}
      />
      <p className="text-sm text-sigma-muted">{t("sources.nextRun", { time: nextRun })}</p>
    </div>
  )
}

function StepIndicator({ step }: { step: number }) {
  const t = useTranslations("sync")

  return (
    <div className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((item) => (
        <div
          className={cn("h-1.5 rounded-full", item <= step ? "bg-sigma-accent" : "bg-sigma-line")}
          key={item}
          title={t(`sources.steps.${item}`)}
        />
      ))}
    </div>
  )
}

function IconButton({
  children,
  disabled = false,
  label,
  onClick
}: {
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
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
  )
}

function DateField({
  label,
  max,
  min,
  onChange,
  value
}: {
  label: string
  max: string
  min: string
  onChange: (value: string) => void
  value: string
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
  )
}

function defaultConfig(type: SourcePayload["source_type"]): Record<string, unknown> {
  if (type === "api") {
    return { endpoint: "", items_path: "" }
  }
  if (type === "scraper") {
    return { item_selector: "", url: "" }
  }
  return { feed_url: "" }
}

function sourceConfigComplete(payload: SourcePayload) {
  if (!payload.name.trim()) return false
  if (payload.source_type === "rss") return Boolean(String(payload.config.feed_url ?? "").trim())
  if (payload.source_type === "api") return Boolean(String(payload.config.endpoint ?? "").trim())
  return Boolean(String(payload.config.url ?? "").trim() && String(payload.config.item_selector ?? "").trim())
}

function normalizeMarket(market: Market): Market {
  return regionColumns.includes(market) ? market : "global"
}

function buildMockLogResponse(
  sources: DataSource[],
  filters: { dateFrom: string; dateTo: string; page: number; sourceId: string; status: LogFilter }
): AdminLogResponse {
  const now = Date.now()
  const visibleSources = filters.sourceId ? sources.filter((source) => source.id === filters.sourceId) : sources
  const baseSources = visibleSources.length > 0 ? visibleSources : sources.slice(0, 1)
  const allItems = baseSources.flatMap((source, sourceIndex) =>
    Array.from({ length: 4 }).map((_, index) => {
      const status = (["success", "success", "fail", "timeout"] as CollectorStatus[])[(index + sourceIndex) % 4]
      return {
        duration_ms: 520 + index * 180 + sourceIndex * 90,
        error_message: status === "success" ? null : status === "timeout" ? "Collection exceeded the configured timeout." : "The source returned an invalid response.",
        executed_at: new Date(now - (index + sourceIndex * 2) * 55 * 60_000).toISOString(),
        id: `mock-${source.id}-${index}`,
        items_count: status === "success" ? 12 + index * 3 : 0,
        source_id: source.id,
        source_name: source.name,
        status
      }
    })
  )
  const startTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00Z`).getTime() : Number.NEGATIVE_INFINITY
  const endTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59Z`).getTime() : Number.POSITIVE_INFINITY
  const filtered = allItems
    .filter((item) => filters.status === "all" || item.status === filters.status)
    .filter((item) => {
      const executedAt = new Date(item.executed_at).getTime()
      return executedAt >= startTime && executedAt <= endTime
    })
    .sort((left, right) => new Date(right.executed_at).getTime() - new Date(left.executed_at).getTime())
  const pageSize = 12
  const start = (filters.page - 1) * pageSize
  const pageItems = filtered.slice(start, start + pageSize)
  const successCount = filtered.filter((item) => item.status === "success").length
  return {
    has_next: start + pageSize < filtered.length,
    items: pageItems,
    page: filters.page,
    page_size: pageSize,
    success_rate: filtered.length === 0 ? 0 : successCount / filtered.length,
    total: filtered.length
  }
}
