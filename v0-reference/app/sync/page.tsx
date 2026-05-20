"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Clock,
  Database,
  Rss,
  Code,
  Settings,
  ChevronDown,
  Activity,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data sources
const dataSources = [
  {
    id: "bloomberg",
    name: "Bloomberg API",
    type: "API",
    icon: "B",
    color: "bg-orange-500",
    status: "active",
    lastSync: "5 min ago",
    itemsToday: 342,
    avgLatency: "1.2s",
    enabled: true,
    hourlyData: [12, 18, 15, 22, 19, 25, 30, 28, 35, 32, 29, 26, 31, 28, 24, 20, 18, 22, 26, 30, 28, 25, 22, 19],
  },
  {
    id: "reuters",
    name: "Reuters RSS",
    type: "RSS",
    icon: "R",
    color: "bg-blue-500",
    status: "active",
    lastSync: "2 min ago",
    itemsToday: 186,
    avgLatency: "0.8s",
    enabled: true,
    hourlyData: [8, 12, 10, 15, 18, 14, 16, 20, 22, 19, 17, 15, 18, 21, 19, 16, 14, 12, 15, 18, 20, 17, 14, 11],
  },
  {
    id: "techcrunch",
    name: "TechCrunch RSS",
    type: "RSS",
    icon: "T",
    color: "bg-green-500",
    status: "active",
    lastSync: "8 min ago",
    itemsToday: 67,
    avgLatency: "0.5s",
    enabled: true,
    hourlyData: [3, 5, 4, 6, 8, 7, 5, 4, 6, 8, 9, 7, 5, 4, 3, 5, 6, 8, 7, 5, 4, 3, 2, 4],
  },
  {
    id: "newsapi",
    name: "NewsAPI",
    type: "API",
    icon: "N",
    color: "bg-purple-500",
    status: "error",
    lastSync: "1 hour ago",
    itemsToday: 0,
    avgLatency: "—",
    enabled: true,
    hourlyData: [20, 22, 18, 25, 28, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "alphavantage",
    name: "Alpha Vantage API",
    type: "API",
    icon: "A",
    color: "bg-yellow-500",
    status: "active",
    lastSync: "1 min ago",
    itemsToday: 1024,
    avgLatency: "0.3s",
    enabled: true,
    hourlyData: [40, 45, 42, 48, 52, 50, 55, 58, 54, 50, 48, 52, 56, 54, 50, 46, 42, 45, 48, 52, 50, 46, 42, 38],
  },
  {
    id: "finnhub",
    name: "Finnhub API",
    type: "API",
    icon: "F",
    color: "bg-cyan-500",
    status: "active",
    lastSync: "3 min ago",
    itemsToday: 856,
    avgLatency: "0.6s",
    enabled: true,
    hourlyData: [35, 38, 42, 45, 40, 38, 42, 48, 52, 50, 46, 42, 45, 48, 44, 40, 36, 38, 42, 46, 44, 40, 36, 32],
  },
  {
    id: "fred",
    name: "FRED API",
    type: "API",
    icon: "F",
    color: "bg-red-500",
    status: "paused",
    lastSync: "2 days ago",
    itemsToday: 0,
    avgLatency: "2.1s",
    enabled: false,
    hourlyData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "fedreserve",
    name: "Federal Reserve Scraper",
    type: "Scraper",
    icon: "FR",
    color: "bg-emerald-500",
    status: "active",
    lastSync: "15 min ago",
    itemsToday: 12,
    avgLatency: "3.5s",
    enabled: true,
    hourlyData: [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0],
  },
]

// Mock log entries
const logEntries = [
  { id: 1, status: "success", source: "Bloomberg API", message: "Collected 42 items", timestamp: "2 min ago", duration: "1.2s" },
  { id: 2, status: "success", source: "Reuters RSS", message: "Collected 18 items", timestamp: "2 min ago", duration: "0.8s" },
  { id: 3, status: "error", source: "NewsAPI", message: "Rate limit exceeded (429)", timestamp: "5 min ago", duration: "0.1s" },
  { id: 4, status: "success", source: "Alpha Vantage API", message: "Collected 156 items", timestamp: "6 min ago", duration: "0.3s" },
  { id: 5, status: "warning", source: "TechCrunch RSS", message: "Partial data received (timeout)", timestamp: "8 min ago", duration: "5.0s" },
  { id: 6, status: "success", source: "Finnhub API", message: "Collected 89 items", timestamp: "10 min ago", duration: "0.6s" },
  { id: 7, status: "success", source: "Bloomberg API", message: "Collected 38 items", timestamp: "12 min ago", duration: "1.1s" },
  { id: 8, status: "success", source: "Federal Reserve Scraper", message: "Collected 3 items", timestamp: "15 min ago", duration: "3.2s" },
  { id: 9, status: "error", source: "NewsAPI", message: "Connection timeout", timestamp: "20 min ago", duration: "30.0s" },
  { id: 10, status: "success", source: "Reuters RSS", message: "Collected 24 items", timestamp: "22 min ago", duration: "0.9s" },
  { id: 11, status: "warning", source: "Alpha Vantage API", message: "Duplicate entries filtered (12)", timestamp: "25 min ago", duration: "0.4s" },
  { id: 12, status: "success", source: "Finnhub API", message: "Collected 102 items", timestamp: "30 min ago", duration: "0.7s" },
]

// Mock schedule data
const scheduleData = [
  { source: "Bloomberg API", schedule: "Every 30 min", nextRun: "in 25 min", status: "active" },
  { source: "Reuters RSS", schedule: "Every 30 min", nextRun: "in 28 min", status: "active" },
  { source: "TechCrunch RSS", schedule: "Every hour", nextRun: "in 52 min", status: "active" },
  { source: "NewsAPI", schedule: "Every 30 min", nextRun: "Paused", status: "error" },
  { source: "Alpha Vantage API", schedule: "Every 15 min", nextRun: "in 14 min", status: "active" },
  { source: "Finnhub API", schedule: "Every 30 min", nextRun: "in 27 min", status: "active" },
  { source: "FRED API", schedule: "Daily 3AM", nextRun: "Paused", status: "paused" },
  { source: "Federal Reserve Scraper", schedule: "Every 2 hours", nextRun: "in 1h 45m", status: "active" },
]

export default function SyncPage() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [sources, setSources] = useState(dataSources)
  const [logFilter, setLogFilter] = useState("all")
  const [filterOpen, setFilterOpen] = useState(false)

  const handleSyncAll = () => {
    setIsSyncing(true)
    setTimeout(() => setIsSyncing(false), 2000)
  }

  const handleToggleSource = (id: string) => {
    setSources(sources.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled, status: !s.enabled ? "active" : "paused" } : s
    ))
  }

  const filteredLogs = logEntries.filter(log => {
    if (logFilter === "all") return true
    if (logFilter === "success") return log.status === "success"
    if (logFilter === "errors") return log.status === "error"
    if (logFilter === "warnings") return log.status === "warning"
    return true
  })

  const activeSources = sources.filter(s => s.status === "active").length

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sync</h1>
          <p className="text-sm text-muted-foreground">Data pipeline status and collection management</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-1 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-chart-1"></span>
            </span>
            Last synced: <span className="text-foreground font-medium">2 min ago</span>
          </div>
          <motion.button
            onClick={handleSyncAll}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            Sync All Now
          </motion.button>
        </div>
      </motion.div>

      {/* Pipeline Status */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Active Sources */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Sources</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-foreground">{activeSources}</span>
                <span className="text-sm text-muted-foreground">of {sources.length} total</span>
              </div>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted/30"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={`${(activeSources / sources.length) * 176} 176`}
                  strokeLinecap="round"
                  className="text-chart-1"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Database className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Today's Collections */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{"Today's Collections"}</p>
              <p className="text-3xl font-bold text-foreground mt-1">2,847</p>
              <p className="text-sm text-chart-1 mt-1">+124 vs yesterday</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-chart-1/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-chart-1" />
            </div>
          </div>
        </motion.div>

        {/* Pipeline Health */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pipeline Health</p>
              <p className="text-3xl font-bold text-foreground mt-1">99.2%</p>
              <p className="text-sm text-muted-foreground mt-1">uptime</p>
            </div>
            <div className="flex items-end gap-0.5 h-12">
              {[98, 99, 100, 99, 100, 99, 99].map((val, i) => (
                <div
                  key={i}
                  className="w-2 rounded-t bg-chart-1"
                  style={{ height: `${val * 0.48}px` }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Data Sources Grid */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Data Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sources.map((source, index) => (
            <motion.div
              key={source.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
              whileHover={{ y: -4 }}
              className={cn(
                "bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all",
                !source.enabled && "opacity-60"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm", source.color)}>
                    {source.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{source.name}</p>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-lg">
                      {source.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  source.status === "active" && "bg-chart-1",
                  source.status === "error" && "bg-chart-2",
                  source.status === "paused" && "bg-chart-4"
                )} />
                <span className={cn(
                  "text-xs font-medium capitalize",
                  source.status === "active" && "text-chart-1",
                  source.status === "error" && "text-chart-2",
                  source.status === "paused" && "text-chart-4"
                )}>
                  {source.status}
                </span>
              </div>

              {/* Stats */}
              <div className="space-y-1 text-xs text-muted-foreground mb-3">
                <div className="flex justify-between">
                  <span>Last sync:</span>
                  <span className="text-foreground">{source.lastSync}</span>
                </div>
                <div className="flex justify-between">
                  <span>Items today:</span>
                  <span className="text-foreground">{source.itemsToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg latency:</span>
                  <span className="text-foreground">{source.avgLatency}</span>
                </div>
              </div>

              {/* Mini bar chart */}
              <div className="flex items-end gap-px h-8 mb-4">
                {source.hourlyData.map((val, i) => {
                  const maxVal = Math.max(...source.hourlyData, 1)
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 rounded-t transition-all",
                        source.status === "error" ? "bg-chart-2/50" : "bg-primary/40"
                      )}
                      style={{ height: `${(val / maxVal) * 100}%`, minHeight: val > 0 ? "2px" : "0" }}
                    />
                  )
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <button className="text-xs text-primary hover:underline">Sync Now</button>
                  <button className="text-xs text-muted-foreground hover:text-foreground">Configure</button>
                </div>
                <button
                  onClick={() => handleToggleSource(source.id)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    source.enabled ? "bg-chart-1" : "bg-muted"
                  )}
                >
                  <motion.div
                    animate={{ x: source.enabled ? 20 : 2 }}
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Collection Log & Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection Log */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors"
              >
                {logFilter === "all" ? "All" : logFilter === "success" ? "Success" : logFilter === "errors" ? "Errors" : "Warnings"}
                <ChevronDown className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-10 overflow-hidden min-w-[120px]"
                  >
                    {["all", "success", "errors", "warnings"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => {
                          setLogFilter(filter)
                          setFilterOpen(false)
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors capitalize",
                          logFilter === filter && "text-primary"
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
            {filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * index }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors",
                  log.status === "error" && "border-l-2 border-chart-2"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                  log.status === "success" && "bg-chart-1/20 text-chart-1",
                  log.status === "error" && "bg-chart-2/20 text-chart-2",
                  log.status === "warning" && "bg-chart-4/20 text-chart-4"
                )}>
                  {log.status === "success" && <Check className="w-3 h-3" />}
                  {log.status === "error" && <X className="w-3 h-3" />}
                  {log.status === "warning" && <AlertTriangle className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{log.source}</p>
                  <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{log.duration}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Schedule Overview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">Schedule Overview</h2>
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-4 gap-4 text-xs text-muted-foreground font-medium pb-2 border-b border-border">
              <span>Source</span>
              <span>Schedule</span>
              <span>Next Run</span>
              <span className="text-right">Status</span>
            </div>
            {/* Rows */}
            {scheduleData.map((item, index) => (
              <motion.div
                key={item.source}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                className={cn(
                  "grid grid-cols-4 gap-4 py-3 text-sm border-b border-border/50 last:border-0",
                  item.status === "paused" && "opacity-50"
                )}
              >
                <span className="font-medium text-foreground truncate">{item.source}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.schedule}
                </span>
                <span className={cn(
                  item.status === "active" ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.nextRun}
                </span>
                <span className="text-right">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                    item.status === "active" && "bg-chart-1/10 text-chart-1",
                    item.status === "error" && "bg-chart-2/10 text-chart-2",
                    item.status === "paused" && "bg-chart-4/10 text-chart-4"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      item.status === "active" && "bg-chart-1",
                      item.status === "error" && "bg-chart-2",
                      item.status === "paused" && "bg-chart-4"
                    )} />
                    {item.status}
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
