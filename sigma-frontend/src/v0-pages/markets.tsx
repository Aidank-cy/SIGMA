"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sidebar } from "@/components/dashboard/sidebar"
import { IndicesTab } from "@/components/markets/indices-tab"
import { WatchlistTab } from "@/components/markets/watchlist-tab"
import { SectorsTab } from "@/components/markets/sectors-tab"
import { MarketSummary } from "@/components/markets/market-summary"

const tabs = [
  { id: "indices", label: "Indices" },
  { id: "watchlist", label: "Watchlist" },
  { id: "sectors", label: "Sectors" },
]

export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState("indices")

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="pl-20 transition-all duration-300">
        <div className="p-6 lg:p-8 space-y-8">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <h1 className="text-2xl font-bold text-foreground">Markets</h1>
            <p className="text-muted-foreground mt-1">
              Real-time market data and portfolio tracking
            </p>
          </motion.div>

          {/* Tab Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="flex items-center gap-1 p-1.5 bg-muted/50 rounded-xl w-fit"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-5 py-2.5 text-sm font-medium transition-colors duration-200"
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-card rounded-lg shadow-sm border border-border"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 ${
                    activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            ))}
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === "indices" && <IndicesTab />}
              {activeTab === "watchlist" && <WatchlistTab />}
              {activeTab === "sectors" && <SectorsTab />}
            </motion.div>
          </AnimatePresence>

          {/* Market Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <MarketSummary />
          </motion.div>
        </div>
      </main>
    </div>
  )
}
