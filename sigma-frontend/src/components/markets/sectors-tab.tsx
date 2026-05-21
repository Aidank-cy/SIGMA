"use client"

import { motion } from "framer-motion"
import { BarChart3 } from "lucide-react"
import { useTranslations } from "next-intl"

const regionIds = ["us", "cn", "hk", "jp", "eu", "kr", "tw"] as const

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

export function SectorsTab() {
  const t = useTranslations("markets")

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("sectorsCaption")}</p>

      <motion.div
        animate="show"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        initial="hidden"
        variants={containerVariants}
      >
        {regionIds.map((regionId) => (
          <motion.section
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
            key={regionId}
            variants={itemVariants}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground">{t(`regionNames.${regionId}`)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("sectorEndpointPending")}</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
              </span>
            </div>

            <div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-6 text-center">
              <p className="text-2xl font-semibold text-foreground">{t("notAvailable")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("sectorLiveDataRequired")}</p>
            </div>
          </motion.section>
        ))}
      </motion.div>
    </div>
  )
}
