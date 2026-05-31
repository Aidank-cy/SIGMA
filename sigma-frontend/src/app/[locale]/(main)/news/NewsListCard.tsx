"use client"

import { motion, useInView } from "framer-motion"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useRef } from "react"

import type { Category, ItemSummary, Sentiment } from "@/lib/types"
import { cn } from "@/lib/utils"

const stripeColors: Record<Category, string> = {
  finance: "bg-chart-1",
  macro: "bg-chart-5",
  other: "bg-muted-foreground",
  politics: "bg-chart-3",
  technology: "bg-chart-4"
}

function inferSentiment(item: ItemSummary): Sentiment {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase()
  if (/(fall|drop|risk|bear|decline|weak|cut|pressure|loss)/.test(text)) return "bearish"
  if (/(rise|gain|bull|growth|beat|strong|surge|record|upgrade)/.test(text)) return "bullish"
  return "neutral"
}

function useRelativeTime(date: string) {
  const locale = useLocale()
  return useMemo(() => {
    const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000)
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
    const hours = Math.round(minutes / 60)
    if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
    return formatter.format(Math.round(hours / 24), "day")
  }, [date, locale])
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const t = useTranslations("feed.sentiment")
  return (
    <span className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold", sentiment === "bullish" ? "bg-chart-1/10 text-chart-1" : sentiment === "bearish" ? "bg-chart-2/10 text-chart-2" : "bg-muted text-muted-foreground")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", sentiment === "bullish" ? "bg-chart-1" : sentiment === "bearish" ? "bg-chart-2" : "bg-muted-foreground")} />
      {t(sentiment)}
    </span>
  )
}

export function ListNewsCard({ item, index }: { item: ItemSummary; index: number }) {
  const t = useTranslations("feed")
  const locale = useLocale()
  const ref = useRef(null)
  const isInView = useInView(ref, { margin: "-30px", once: true })
  const sentiment = inferSentiment(item)
  const time = useRelativeTime(item.published_at)

  return (
    <motion.article animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} className="group flex items-stretch overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" initial={{ opacity: 0, y: 20 }} ref={ref} transition={{ delay: index * 0.03, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }} whileHover={{ x: 4, transition: { duration: 0.2 } }}>
      <div className={cn("w-1 shrink-0 rounded-l-2xl", stripeColors[item.category])} />
      <div className="flex flex-1 items-center gap-4 p-6">
        <Link className="min-w-0 flex-1" href={`/${locale}/items/${item.id}`}>
          <h3 className="mb-1 line-clamp-1 font-bold text-foreground transition-colors group-hover:text-primary">{item.title}</h3>
          <p className="line-clamp-1 text-[15px] text-foreground/60">{item.summary ?? t("summaryFallback")}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-foreground/55">
            <span className="font-bold text-foreground/80">{item.source_name}</span>
            <span className="text-foreground/35">|</span>
            <span>{time}</span>
            <span className="text-foreground/35">|</span>
            <span>{t(`categories.${item.category}`)}</span>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <SentimentBadge sentiment={sentiment} />
        </div>
      </div>
    </motion.article>
  )
}
