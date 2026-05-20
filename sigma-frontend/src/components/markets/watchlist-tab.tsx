"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Star, Plus, TrendingUp, TrendingDown } from "lucide-react"
import { useTranslations } from "next-intl"

import { useWatchlists } from "@/hooks/useWatchlists"
import type { Watchlist } from "@/lib/types"

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const height = 24
  const width = 64

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "oklch(0.65 0.22 145)" : "oklch(0.6 0.22 25)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function WatchlistTab() {
  const t = useTranslations("markets")
  const feedT = useTranslations("feed")
  const { data, isLoading } = useWatchlists()
  const watchlists = data?.items ?? []
  const [starred, setStarred] = useState<Set<string>>(new Set())

  const toggleStar = (symbol: string) => {
    const newStarred = new Set(starred)
    if (newStarred.has(symbol)) {
      newStarred.delete(symbol)
    } else {
      newStarred.add(symbol)
    }
    setStarred(newStarred)
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("watchlistCount", { count: watchlists.length })}
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("addStock")}
        </motion.button>
      </div>

      {/* Stock List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="h-20 animate-pulse rounded-xl bg-muted/50" key={index} />
          ))}
        </div>
      ) : watchlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("emptyWatchlist")}
        </div>
      ) : (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        {watchlists.map((watchlist: Watchlist) => {
          const isPositive = watchlist.item_count >= 0
          const isStarred = starred.has(watchlist.id)
          const sparkline = [
            Math.max(1, watchlist.item_count - 4),
            Math.max(1, watchlist.item_count - 2),
            Math.max(1, watchlist.item_count - 3),
            Math.max(1, watchlist.item_count),
            Math.max(1, watchlist.item_count + 1)
          ]

          return (
            <motion.div
              key={watchlist.id}
              variants={itemVariants}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
            >
              {/* Symbol & Name */}
              <div className="min-w-[140px]">
                <p className="font-bold text-foreground">{watchlist.name}</p>
                <p className="text-sm text-muted-foreground">
                  {watchlist.markets.map((market) => feedT(`markets.${market}`)).join(", ") || t("allMarkets")}
                </p>
              </div>

              {/* Price */}
              <div className="min-w-[100px] text-right">
                <p className="font-bold tabular-nums text-foreground">
                  {watchlist.item_count}
                </p>
                <p className="text-xs text-muted-foreground">{t("items")}</p>
              </div>

              {/* Change Badge */}
              <div className="min-w-[80px]">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    isPositive
                      ? "bg-chart-1/10 text-chart-1"
                      : "bg-chart-2/10 text-chart-2"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {isPositive ? "+" : ""}
                  {watchlist.keywords.length}
                </span>
              </div>

              {/* Sparkline */}
              <div className="flex-1 flex justify-center">
                <Sparkline data={sparkline} positive={isPositive} />
              </div>

              {/* Star Button */}
              <motion.button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleStar(watchlist.id)
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-lg transition-colors ${
                  isStarred
                    ? "text-chart-4"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star
                  className="w-5 h-5"
                  fill={isStarred ? "currentColor" : "none"}
                />
              </motion.button>
            </motion.div>
          )
        })}
      </motion.div>
      )}
    </div>
  )
}
