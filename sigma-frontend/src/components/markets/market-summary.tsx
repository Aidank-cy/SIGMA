"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react"

const summaryStats = [
  {
    label: "Advancing",
    value: "2,847",
    icon: TrendingUp,
    color: "text-chart-1",
  },
  {
    label: "Declining",
    value: "1,234",
    icon: TrendingDown,
    color: "text-chart-2",
  },
  {
    label: "Unchanged",
    value: "456",
    icon: Activity,
    color: "text-muted-foreground",
  },
  {
    label: "52-Week Highs",
    value: "89",
    icon: TrendingUp,
    color: "text-chart-1",
  },
  {
    label: "52-Week Lows",
    value: "24",
    icon: TrendingDown,
    color: "text-chart-2",
  },
  {
    label: "Most Active",
    value: "NVDA",
    icon: BarChart3,
    color: "text-primary",
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

export function MarketSummary() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="bg-card border border-border rounded-xl p-6"
    >
      <h2 className="text-lg font-semibold text-foreground mb-5">
        Market Summary
      </h2>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        {summaryStats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ y: -2 }}
            className="bg-background/50 rounded-lg p-4 transition-all hover:bg-background/80"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground tabular-nums">
              {stat.value}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}
