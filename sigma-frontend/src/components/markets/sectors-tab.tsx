"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { GripVertical, TrendingDown, TrendingUp } from "lucide-react"
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
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
}

const sectorOrderStorageKey = "sigma.sectorRegionOrder"
const defaultRegionOrder = sectorRegions.map((region) => region.id)

export function SectorsTab() {
  const t = useTranslations("markets")
  const [draggedRegion, setDraggedRegion] = useState<string | null>(null)
  const [regionOrder, setRegionOrder] = useState<string[]>(defaultRegionOrder)
  const regionsById = useMemo(() => new Map(sectorRegions.map((region) => [region.id, region])), [])
  const orderedRegions = regionOrder
    .map((regionId) => regionsById.get(regionId))
    .filter((region): region is SectorRegion => region !== undefined)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(sectorOrderStorageKey)
      const parsed = stored ? JSON.parse(stored) : null
      if (Array.isArray(parsed)) {
        const savedOrder = parsed.filter((regionId): regionId is string => defaultRegionOrder.includes(regionId))
        const missingRegions = defaultRegionOrder.filter((regionId) => !savedOrder.includes(regionId))
        setRegionOrder([...savedOrder, ...missingRegions])
      }
    } catch {
      setRegionOrder(defaultRegionOrder)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(sectorOrderStorageKey, JSON.stringify(regionOrder))
    } catch {
      return
    }
  }, [regionOrder])

  const moveRegion = (targetRegion: string) => {
    if (!draggedRegion || draggedRegion === targetRegion) {
      return
    }
    setRegionOrder((current) => {
      const fromIndex = current.indexOf(draggedRegion)
      const toIndex = current.indexOf(targetRegion)
      if (fromIndex === -1 || toIndex === -1) {
        return current
      }
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
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
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {orderedRegions.map((region) => (
          <motion.section
            className={cn(
              "rounded-xl border border-border bg-card p-5 transition-colors",
              draggedRegion === region.id ? "border-primary/60 bg-muted/35" : "hover:border-primary/30"
            )}
            draggable
            key={region.id}
            onDragEnd={() => setDraggedRegion(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event) => {
              if ("dataTransfer" in event) {
                const dataTransfer = event.dataTransfer as DataTransfer
                dataTransfer.effectAllowed = "move"
              }
              setDraggedRegion(region.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              moveRegion(region.id)
              setDraggedRegion(null)
            }}
            variants={itemVariants}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground">{t(`regionNames.${region.id}`)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("sectorCount", { count: region.sectors.length })}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing">
                <GripVertical className="h-4 w-4" />
              </span>
            </div>

            <div className="space-y-4">
              {region.sectors.map((sector) => {
                const isPositive = sector.change >= 0

                return (
                  <div key={`${region.id}-${sector.name}`} className="group">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold text-foreground">{t(`sectorNames.${sector.name}`)}</h4>
                        <span
                          className={cn(
                            "mt-1 flex items-center gap-1 text-sm font-semibold",
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
                        transition={{ damping: 35, mass: 0.8, stiffness: 500, type: "spring" }}
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
          </motion.section>
        ))}
      </motion.div>
    </div>
  )
}
