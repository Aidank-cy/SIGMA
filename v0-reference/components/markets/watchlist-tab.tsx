"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Star, Plus, TrendingUp, TrendingDown } from "lucide-react"

const watchlistStocks = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 189.84,
    change: 2.34,
    sparkline: [45, 48, 52, 50, 55, 58, 54, 60, 58, 62, 65, 68],
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    price: 177.48,
    change: 2.87,
    sparkline: [40, 45, 42, 50, 48, 55, 52, 58, 60, 65, 62, 68],
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    price: 875.28,
    change: 4.56,
    sparkline: [35, 42, 48, 52, 58, 55, 62, 68, 72, 78, 82, 88],
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    price: 505.95,
    change: -1.23,
    sparkline: [70, 68, 72, 65, 68, 62, 65, 58, 62, 55, 58, 52],
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    price: 141.80,
    change: -0.45,
    sparkline: [55, 58, 52, 55, 50, 52, 48, 50, 45, 48, 42, 45],
  },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    price: 178.25,
    change: 3.21,
    sparkline: [40, 45, 48, 52, 50, 58, 55, 62, 60, 68, 72, 75],
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    price: 428.52,
    change: 1.45,
    sparkline: [50, 52, 55, 58, 55, 62, 60, 65, 68, 72, 70, 75],
  },
  {
    symbol: "BRK.B",
    name: "Berkshire Hathaway",
    price: 408.32,
    change: 0.89,
    sparkline: [48, 50, 52, 55, 52, 58, 55, 60, 58, 62, 60, 65],
  },
]

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
  const [starred, setStarred] = useState<Set<string>>(
    new Set(watchlistStocks.map((s) => s.symbol))
  )

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
          {watchlistStocks.length} stocks in your watchlist
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Stock
        </motion.button>
      </div>

      {/* Stock List */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        {watchlistStocks.map((stock) => {
          const isPositive = stock.change >= 0
          const isStarred = starred.has(stock.symbol)

          return (
            <motion.div
              key={stock.symbol}
              variants={itemVariants}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
            >
              {/* Symbol & Name */}
              <div className="min-w-[140px]">
                <p className="font-bold text-foreground">{stock.symbol}</p>
                <p className="text-sm text-muted-foreground">{stock.name}</p>
              </div>

              {/* Price */}
              <div className="min-w-[100px] text-right">
                <p className="font-bold tabular-nums text-foreground">
                  ${stock.price.toFixed(2)}
                </p>
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
                  {stock.change.toFixed(2)}%
                </span>
              </div>

              {/* Sparkline */}
              <div className="flex-1 flex justify-center">
                <Sparkline data={stock.sparkline} positive={isPositive} />
              </div>

              {/* Star Button */}
              <motion.button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleStar(stock.symbol)
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
    </div>
  )
}
