"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { AreaChart, Area, ResponsiveContainer } from "recharts"

const indices = [
  {
    name: "S&P 500",
    symbol: "SPX",
    price: 5842.31,
    change: 1.24,
    data: [45, 52, 48, 61, 55, 72, 68, 85, 78, 92, 88, 95, 102, 98, 110],
  },
  {
    name: "NASDAQ",
    symbol: "IXIC",
    price: 18432.65,
    change: 1.87,
    data: [30, 35, 42, 38, 55, 48, 62, 58, 75, 68, 82, 78, 90, 85, 95],
  },
  {
    name: "DOW JONES",
    symbol: "DJI",
    price: 42156.89,
    change: 0.78,
    data: [55, 58, 52, 65, 60, 72, 68, 75, 70, 82, 78, 85, 80, 90, 88],
  },
  {
    name: "RUSSELL 2000",
    symbol: "RUT",
    price: 2287.45,
    change: -0.34,
    data: [75, 72, 68, 70, 65, 62, 68, 64, 60, 58, 62, 55, 58, 52, 54],
  },
  {
    name: "Japan 225",
    symbol: "NI225",
    price: 38742.12,
    change: 0.92,
    data: [40, 45, 48, 52, 48, 58, 55, 62, 58, 68, 65, 72, 68, 75, 78],
  },
  {
    name: "SSE Composite",
    symbol: "SSEC",
    price: 3245.67,
    change: -0.56,
    data: [80, 78, 82, 76, 72, 75, 68, 72, 65, 68, 62, 65, 58, 60, 55],
  },
  {
    name: "FTSE 100",
    symbol: "FTSE",
    price: 8456.23,
    change: 0.45,
    data: [50, 52, 55, 58, 54, 62, 58, 65, 62, 68, 65, 72, 68, 75, 72],
  },
  {
    name: "DAX",
    symbol: "DAX",
    price: 18234.89,
    change: 1.12,
    data: [42, 48, 52, 58, 55, 65, 62, 72, 68, 78, 75, 82, 78, 88, 92],
  },
  {
    name: "CAC 40",
    symbol: "CAC",
    price: 7856.34,
    change: 0.67,
    data: [48, 52, 48, 58, 55, 62, 58, 68, 65, 72, 68, 75, 72, 78, 82],
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

export function IndicesTab() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {indices.map((index) => {
        const isPositive = index.change >= 0
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
                {index.price.toLocaleString("en-US", {
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
                  {index.change.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Chart */}
            <div className="h-24 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={index.data.map((value) => ({ value }))}>
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
