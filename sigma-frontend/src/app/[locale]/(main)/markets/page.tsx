"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { IndicesTab } from "@/components/markets/indices-tab"
import { MarketSummary } from "@/components/markets/market-summary"
import { SectorsTab } from "@/components/markets/sectors-tab"
import { WatchlistTab } from "@/components/markets/watchlist-tab"

type MarketTab = "indices" | "watchlist" | "sectors"

const tabIds: MarketTab[] = ["indices", "watchlist", "sectors"]

export default function MarketsPage() {
  const t = useTranslations("markets")
  const [activeTab, setActiveTab] = useState<MarketTab>("indices")

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex w-fit items-center gap-1 rounded-xl bg-muted/50 p-1.5"
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {tabIds.map((tab) => (
          <button
            className="relative min-h-11 px-5 py-2.5 text-sm font-medium transition-colors duration-200"
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {activeTab === tab && (
              <motion.div
                className="absolute inset-0 rounded-lg border border-border bg-card shadow-sm"
                layoutId="marketsActiveTab"
                transition={{ damping: 30, stiffness: 400, type: "spring" }}
              />
            )}
            <span className={activeTab === tab ? "relative z-10 text-foreground" : "relative z-10 text-muted-foreground hover:text-foreground"}>
              {t(tab)}
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          initial={{ opacity: 0, y: 20 }}
          key={activeTab}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "indices" && <IndicesTab />}
          {activeTab === "watchlist" && <WatchlistTab />}
          {activeTab === "sectors" && <SectorsTab />}
        </motion.div>
      </AnimatePresence>

      <MarketSummary />
    </div>
  )
}
