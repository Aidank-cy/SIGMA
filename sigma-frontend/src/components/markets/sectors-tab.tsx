"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

interface Sector {
  change: number
  name: string
  value: number
}

interface SectorRegion {
  id: string
  sectors: Sector[]
}

const sectorRegions: SectorRegion[] = [
  {
    id: "us",
    sectors: [
      { name: "technology", change: 2.45, value: 85 },
      { name: "healthcare", change: 1.12, value: 72 },
      { name: "finance", change: -0.34, value: 48 },
      { name: "energy", change: -1.56, value: 35 },
      { name: "consumer", change: 0.89, value: 65 },
      { name: "industrial", change: 0.45, value: 58 }
    ]
  },
  {
    id: "cn",
    sectors: [
      { name: "technology", change: 1.94, value: 78 },
      { name: "finance", change: 0.58, value: 62 },
      { name: "consumer", change: -0.28, value: 55 },
      { name: "industrial", change: 0.34, value: 51 },
      { name: "realEstate", change: -1.21, value: 38 }
    ]
  },
  {
    id: "jp",
    sectors: [
      { name: "automotive", change: 1.46, value: 74 },
      { name: "electronics", change: 0.92, value: 68 },
      { name: "finance", change: -0.18, value: 49 },
      { name: "industrial", change: 0.63, value: 59 }
    ]
  },
  {
    id: "eu",
    sectors: [
      { name: "luxury", change: 0.74, value: 66 },
      { name: "automotive", change: -0.42, value: 52 },
      { name: "finance", change: 0.31, value: 57 },
      { name: "energy", change: -0.86, value: 43 },
      { name: "pharmaceuticals", change: 1.18, value: 71 }
    ]
  },
  {
    id: "kr",
    sectors: [
      { name: "semiconductor", change: 2.12, value: 82 },
      { name: "automotive", change: 0.69, value: 61 },
      { name: "electronics", change: 1.24, value: 73 },
      { name: "finance", change: -0.22, value: 46 }
    ]
  },
  {
    id: "tw",
    sectors: [
      { name: "semiconductor", change: 2.34, value: 88 },
      { name: "electronics", change: 1.08, value: 70 },
      { name: "finance", change: 0.27, value: 54 }
    ]
  }
]

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
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4 } }
}

export function SectorsTab() {
  const t = useTranslations("markets")
  const [openRegions, setOpenRegions] = useState<Set<string>>(
    () => new Set(sectorRegions.map((region) => region.id))
  )

  const toggleRegion = (regionId: string) => {
    setOpenRegions((current) => {
      const next = new Set(current)
      if (next.has(regionId)) {
        next.delete(regionId)
      } else {
        next.add(regionId)
      }
      return next
    })
  }

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
        {sectorRegions.map((region) => {
          const isOpen = openRegions.has(region.id)

          return (
            <motion.section
              key={region.id}
              variants={itemVariants}
              className="rounded-xl border border-border bg-card"
            >
              <button
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => toggleRegion(region.id)}
                type="button"
              >
                <div>
                  <h3 className="font-semibold text-foreground">{t(`regionNames.${region.id}`)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("sectorCount", { count: region.sectors.length })}
                  </p>
                </div>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </motion.span>
              </button>

              {isOpen ? (
                <div className="space-y-4 border-t border-border px-5 py-4">
                  {region.sectors.map((sector) => {
                    const isPositive = sector.change >= 0

                    return (
                      <div key={`${region.id}-${sector.name}`} className="group">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-foreground">{t(`sectorNames.${sector.name}`)}</h4>
                            <span
                              className={cn(
                                "flex items-center gap-1 text-sm font-semibold",
                                isPositive ? "text-chart-1" : "text-chart-2"
                              )}
                            >
                              {isPositive ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              {isPositive ? "+" : ""}
                              {sector.change.toFixed(2)}%
                            </span>
                          </div>
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {sector.value}%
                          </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${sector.value}%` }}
                            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                            className={cn(
                              "h-full rounded-full",
                              isPositive
                                ? "bg-gradient-to-r from-chart-1/80 to-chart-1"
                                : "bg-gradient-to-r from-chart-2/80 to-chart-2"
                            )}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </motion.section>
          )
        })}
      </motion.div>
    </div>
  )
}
