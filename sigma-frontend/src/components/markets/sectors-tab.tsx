"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useTranslations } from "next-intl"

const sectors = [
  { name: "Technology", change: 2.45, value: 85 },
  { name: "Healthcare", change: 1.12, value: 72 },
  { name: "Finance", change: -0.34, value: 48 },
  { name: "Energy", change: -1.56, value: 35 },
  { name: "Consumer", change: 0.89, value: 65 },
  { name: "Industrial", change: 0.45, value: 58 },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4 } },
}

export function SectorsTab() {
  const t = useTranslations("markets")
  const sortedSectors = [...sectors].sort((a, b) => b.change - a.change)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t("sectorsCaption")}
      </p>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {sortedSectors.map((sector) => {
          const isPositive = sector.change >= 0

          return (
            <motion.div
              key={sector.name}
              variants={itemVariants}
              className="group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground">{t(`sectorNames.${sector.name.toLowerCase()}`)}</h3>
                  <span
                    className={`flex items-center gap-1 text-sm font-semibold ${
                      isPositive ? "text-chart-1" : "text-chart-2"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {isPositive ? "+" : ""}
                    {sector.change.toFixed(2)}%
                  </span>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {sector.value}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${sector.value}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    isPositive
                      ? "bg-gradient-to-r from-chart-1/80 to-chart-1"
                      : "bg-gradient-to-r from-chart-2/80 to-chart-2"
                  }`}
                />
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Treemap-style visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-8"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          {t("marketCapDistribution")}
        </h3>
        <div className="grid grid-cols-6 gap-2 h-32">
          {sortedSectors.map((sector, index) => {
            const isPositive = sector.change >= 0
            const width = sector.value / 100

            return (
              <motion.div
                key={sector.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                style={{ gridColumn: `span ${Math.max(1, Math.round(width * 2))}` }}
                className={`rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all ${
                  isPositive
                    ? "bg-chart-1/20 hover:bg-chart-1/30 border border-chart-1/30"
                    : "bg-chart-2/20 hover:bg-chart-2/30 border border-chart-2/30"
                }`}
              >
                <span className="text-xs font-medium text-foreground truncate">
                  {t(`sectorNames.${sector.name.toLowerCase()}`)}
                </span>
                <span
                  className={`text-sm font-bold ${
                    isPositive ? "text-chart-1" : "text-chart-2"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {sector.change.toFixed(2)}%
                </span>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
