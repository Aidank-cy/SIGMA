"use client"

import { motion } from "framer-motion"
import { Activity, BarChart3, TrendingDown, TrendingUp } from "lucide-react"
import { useTranslations } from "next-intl"

import { useMarketIndices } from "@/hooks/useMarketIndices"

const summaryKeys = ["Advancing", "Declining", "Unchanged", "52-Week Highs", "52-Week Lows", "Most Active"] as const

const summaryIcons = {
  "52-Week Highs": TrendingUp,
  "52-Week Lows": TrendingDown,
  Advancing: TrendingUp,
  Declining: TrendingDown,
  "Most Active": BarChart3,
  Unchanged: Activity
}

const summaryColors = {
  "52-Week Highs": "text-foreground/55",
  "52-Week Lows": "text-foreground/55",
  Advancing: "text-chart-1",
  Declining: "text-chart-2",
  "Most Active": "text-foreground/55",
  Unchanged: "text-foreground/55"
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

export function MarketSummary() {
  const t = useTranslations("markets")
  const { data, isLoading } = useMarketIndices()
  const indices = data?.indices ?? []
  const advancing = indices.filter((index) => index.change_pct > 0).length
  const declining = indices.filter((index) => index.change_pct < 0).length
  const unchanged = indices.filter((index) => index.change_pct === 0).length
  const values: Record<(typeof summaryKeys)[number], string> = {
    "52-Week Highs": t("notAvailable"),
    "52-Week Lows": t("notAvailable"),
    Advancing: isLoading ? t("loadingValue") : String(advancing),
    Declining: isLoading ? t("loadingValue") : String(declining),
    "Most Active": t("notAvailable"),
    Unchanged: isLoading ? t("loadingValue") : String(unchanged)
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-6"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{t("marketSummary")}</h2>
        <p className="text-sm text-foreground/70">{t("marketSummaryCaption")}</p>
      </div>

      <motion.div
        animate="show"
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
        initial="hidden"
        variants={containerVariants}
      >
        {summaryKeys.map((key) => {
          const Icon = summaryIcons[key]
          return (
            <motion.div
              className="rounded-lg bg-background/50 p-4 transition-all hover:bg-background/80"
              key={key}
              variants={itemVariants}
              whileHover={{ y: -2 }}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${summaryColors[key]}`} />
                <span className="text-xs text-foreground/55">{t(`summary.${key}`)}</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-foreground">{values[key]}</p>
            </motion.div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
