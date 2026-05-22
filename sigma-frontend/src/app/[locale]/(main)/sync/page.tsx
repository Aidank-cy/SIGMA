"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Activity, AlertTriangle, Check, ChevronDown, Code, Database, RefreshCw, Rss, Settings, X, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/components/AuthProvider"
import { useToast } from "@/components/ui/Toast"
import { useItems } from "@/hooks/useItems"
import { useSources } from "@/hooks/useSources"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DataSource } from "@/lib/types"
import type { AdminLogResponse } from "@/hooks/useAdmin"

type LogFilter = "all" | "success" | "fail" | "timeout"

const sourceColors = ["bg-orange-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500", "bg-cyan-500", "bg-red-500", "bg-emerald-500"]

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
  const adminT = useTranslations("admin")
  const locale = useLocale()
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { data, isLoading, mutate } = useSources()
  const todayIso = useMemo(() => todayStart(), [])
  const todayItems = useItems({ date_from: todayIso, page_size: 1 })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState<LogFilter>("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [logs, setLogs] = useState<AdminLogResponse | null>(null)
  const sources = data?.items ?? []
  const activeSources = sources.filter((source) => source.is_active).length
  const todayTotal = todayItems.data?.pages[0]?.total ?? 0
  const isAdmin = user?.role === "admin"
  const pipelineHealth = sources.length === 0 ? 0 : Math.round((activeSources / sources.length) * 100)

  useEffect(() => {
    if (!isAdmin) return
    apiFetch<AdminLogResponse>("/admin/logs?page=1&page_size=12")
      .then(setLogs)
      .catch(() => setLogs(null))
  }, [isAdmin])

  const filteredLogs = useMemo(() => {
    const items = logs?.items ?? []
    if (logFilter === "all") return items
    return items.filter((log) => log.status === logFilter)
  }, [logFilter, logs?.items])

  function refreshSyncDataAfter(delay: number) {
    setTimeout(() => {
      mutate()
      todayItems.mutate()
      if (isAdmin) {
        apiFetch<AdminLogResponse>("/admin/logs?page=1&page_size=12")
          .then(setLogs)
          .catch(() => {})
      }
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

  async function handleToggleSource(source: DataSource) {
    if (!isAdmin) {
      showToast(t("adminOnly"), "error")
      return
    }
    try {
      await apiFetch(`/admin/sources/${source.id}/toggle`, {
        body: JSON.stringify({ is_active: !source.is_active }),
        method: "PUT"
      })
      mutate()
      showToast(t("sourceUpdated"), "success")
    } catch {
      showToast(t("sourceUpdateError"), "error")
    }
  }

  function handleConfigureSources() {
    router.push(`/${locale}/settings?admin=sources`)
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

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("dataSources")}</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => <div className="h-56 animate-pulse rounded-xl border border-border bg-card" key={index} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sources.map((source, index) => (
              <SourceCard
                canAdmin={isAdmin}
                index={index}
                isSyncing={syncingSourceId === source.id}
                key={source.id}
                onConfigure={handleConfigureSources}
                onSync={() => handleSyncSource(source.id)}
                onToggle={() => handleToggleSource(source)}
                source={source}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{t("recentActivity")}</h2>
            <div className="relative">
              <button className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground" onClick={() => setFilterOpen((current) => !current)} type="button">
                {t(`filters.${logFilter}`)}
                <ChevronDown className={cn("h-4 w-4 transition-transform", filterOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {filterOpen && (
                  <motion.div animate={{ opacity: 1, y: 0 }} className="absolute right-0 top-full z-10 mt-2 w-36 overflow-hidden rounded-lg border border-border bg-popover shadow-xl" exit={{ opacity: 0, y: -8 }} initial={{ opacity: 0, y: -8 }}>
                    {(["all", "success", "fail", "timeout"] as LogFilter[]).map((filter) => (
                      <button className={cn("w-full px-3 py-2 text-left text-sm hover:bg-muted", logFilter === filter && "text-primary")} key={filter} onClick={() => { setLogFilter(filter); setFilterOpen(false) }} type="button">
                        {t(`filters.${filter}`)}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {!isAdmin ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{t("adminLogsOnly")}</p>
          ) : filteredLogs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{adminT("logs.empty")}</p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-2">
              {filteredLogs.map((log) => (
                <div className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50" key={log.id}>
                  <StatusIcon status={log.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium text-foreground">{log.source_name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(log.executed_at, locale)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{log.error_message ?? t("collectedItems", { count: log.items_count, duration: Math.round(log.duration_ms) })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-5 text-lg font-semibold text-foreground">{t("scheduleOverview")}</h2>
          <div className="space-y-3">
            {sources.slice(0, 8).map((source) => (
              <div className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50" key={source.id}>
                <div className="flex items-center gap-3">
                  <div className={cn("h-2 w-2 rounded-full", source.is_active ? "bg-chart-1" : "bg-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{source.name}</p>
                    <p className="text-xs text-muted-foreground">{source.schedule_cron ?? t("manual")}</p>
                  </div>
                </div>
                <span className={cn("rounded-full px-2 py-1 text-xs font-medium", source.is_active ? "bg-chart-1/10 text-chart-1" : "bg-muted text-muted-foreground")}>
                  {source.is_active ? t("active") : t("paused")}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
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

function SourceCard({
  canAdmin,
  index,
  isSyncing,
  onConfigure,
  onSync,
  onToggle,
  source
}: {
  canAdmin: boolean
  index: number
  isSyncing: boolean
  onConfigure: () => void
  onSync: () => void
  onToggle: () => void
  source: DataSource
}) {
  const t = useTranslations("sync")
  const feedT = useTranslations("feed")
  const Icon = sourceIcon(source.source_type)

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.04 }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white", sourceColors[index % sourceColors.length])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{source.name}</h3>
            <p className="text-xs text-muted-foreground">{t(`sourceTypes.${source.source_type}`)}</p>
          </div>
        </div>
        <button aria-label={t("configure")} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={onConfigure} type="button">
          <Settings className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-4 flex items-center gap-2">
        <StatusIcon status={source.is_active ? "success" : "timeout"} />
        <span className={cn("text-sm font-medium", source.is_active ? "text-chart-1" : "text-muted-foreground")}>
          {source.is_active ? t("active") : t("paused")}
        </span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">{t("category")}</p>
          <p className="font-medium text-foreground">{feedT(`categories.${source.category}`)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("market")}</p>
          <p className="font-medium text-foreground">{feedT(`markets.${source.market}`)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50" disabled={isSyncing} onClick={onSync} type="button">
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          {t("syncNow")}
        </button>
        <button
          className={cn("relative h-9 w-16 rounded-full transition-colors", source.is_active ? "bg-primary" : "bg-muted", !canAdmin && "cursor-not-allowed opacity-60")}
          onClick={onToggle}
          type="button"
        >
          <motion.div animate={{ x: source.is_active ? 28 : 4 }} className="absolute top-1 h-7 w-7 rounded-full bg-white shadow-sm" transition={{ damping: 30, stiffness: 500, type: "spring" }} />
        </button>
      </div>
    </motion.div>
  )
}

function StatusIcon({ status }: { status: "success" | "fail" | "timeout" }) {
  if (status === "success") {
    return <div className="flex h-6 w-6 items-center justify-center rounded-full bg-chart-1/10"><Check className="h-3.5 w-3.5 text-chart-1" /></div>
  }
  if (status === "fail") {
    return <div className="flex h-6 w-6 items-center justify-center rounded-full bg-chart-2/10"><X className="h-3.5 w-3.5 text-chart-2" /></div>
  }
  return <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /></div>
}
