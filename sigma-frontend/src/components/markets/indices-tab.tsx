"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { AreaChart, Area, ResponsiveContainer } from "recharts"

import { useMarketIndices } from "@/hooks/useMarketIndices"

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

export function IndicesTab() {
  const t = useTranslations("markets")
  const { data, isLoading } = useMarketIndices()
  const indices = data?.indices ?? []

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="h-52 animate-pulse rounded-xl border border-border bg-card" key={index} />
        ))}
      </div>
    )
  }

  if (indices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {indices.map((index) => {
        const isPositive = index.change_pct >= 0
        const sparkline = index.sparkline_24h.length > 0 ? index.sparkline_24h : [index.value]
        const chartColor = isPositive
          ? "oklch(0.65 0.22 145)"
          : "oklch(0.6 0.22 25)"
        const chartColorFaded = isPositive
          ? "oklch(0.65 0.22 145 / 0.1)"
          : "oklch(0.6 0.22 25 / 0.1)"

        return (
          <motion.div
            key={index.symbol}
            variants={itemVariants}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground">{index.name}</h3>
              <span className="bg-muted px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground">
                {index.symbol}
              </span>
            </div>

            {/* Price & Change */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-bold tabular-nums text-foreground">
                {index.value.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${
                  isPositive ? "text-chart-1" : "text-chart-2"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>
                  {isPositive ? "+" : ""}
                  {index.change_pct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Chart */}
            <div className="h-24 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline.map((value) => ({ value }))}>
                  <defs>
                    <linearGradient
                      id={`gradient-${index.symbol}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColorFaded} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill={`url(#gradient-${index.symbol})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
