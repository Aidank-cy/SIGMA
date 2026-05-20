"use client"

import { AnimatePresence, motion, useInView } from "framer-motion"
import { ArrowUpRight, Bookmark, BookmarkCheck, Check, ChevronDown, Clock, LayoutGrid, List, Loader2, Search, X } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useItems } from "@/hooks/useItems"
import { cn } from "@/lib/utils"
import type { Category, ItemFilters, ItemSummary, Market, Sentiment } from "@/lib/types"

type ViewMode = "grid" | "list"

const categoryFilters: Array<Category | ""> = ["", "politics", "finance", "technology", "macro"]
const marketFilters: Array<Market | ""> = ["", "us", "cn", "hk", "jp", "eu"]
const sortOptions = ["latest", "relevant", "discussed"] as const

const categoryGradients: Record<Category, string> = {
  finance: "from-emerald-600/80 via-emerald-500/60 to-emerald-400/40",
  macro: "from-amber-500/80 via-amber-400/60 to-amber-300/40",
  other: "from-muted-foreground/60 via-muted-foreground/40 to-muted/40",
  politics: "from-indigo-600/80 via-indigo-500/60 to-indigo-400/40",
  technology: "from-purple-600/80 via-purple-500/60 to-purple-400/40"
}

const stripeColors: Record<Category, string> = {
  finance: "bg-chart-1",
  macro: "bg-amber-500",
  other: "bg-muted-foreground",
  politics: "bg-indigo-500",
  technology: "bg-primary"
}

function inferSentiment(item: ItemSummary): Sentiment {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase()
  if (/(fall|drop|risk|bear|decline|weak|cut|pressure|loss)/.test(text)) {
    return "bearish"
  }
  if (/(rise|gain|bull|growth|beat|strong|surge|record|upgrade)/.test(text)) {
    return "bullish"
  }
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

function CustomSelect({
  options,
  value,
  onChange
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <motion.button
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium transition-all duration-200",
          isOpen ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40"
        )}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-foreground">{selectedOption?.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute left-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur-xl"
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-1">
              {options.map((option, index) => (
                <motion.button
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    value === option.value ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  transition={{ delay: index * 0.03 }}
                  type="button"
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check className="h-4 w-4 text-primary" />}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const t = useTranslations("feed.sentiment")
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        sentiment === "bullish" ? "bg-chart-1/10 text-chart-1" : sentiment === "bearish" ? "bg-chart-2/10 text-chart-2" : "bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", sentiment === "bullish" ? "bg-chart-1" : sentiment === "bearish" ? "bg-chart-2" : "bg-muted-foreground")} />
      {t(sentiment)}
    </span>
  )
}

function GridNewsCard({
  item,
  index,
  isBookmarked,
  onToggleBookmark
}: {
  item: ItemSummary
  index: number
  isBookmarked: boolean
  onToggleBookmark: (id: string) => void
}) {
  const t = useTranslations("feed")
  const locale = useLocale()
  const ref = useRef(null)
  const isInView = useInView(ref, { margin: "-50px", once: true })
  const sentiment = inferSentiment(item)
  const time = useRelativeTime(item.published_at)

  return (
    <motion.article
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
      initial={{ opacity: 0, y: 40 }}
      ref={ref}
      transition={{ delay: index * 0.04, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
    >
      <div className={cn("relative h-[120px] bg-gradient-to-br", categoryGradients[item.category])}>
        <motion.button
          className="absolute right-3 top-3 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          onClick={() => onToggleBookmark(item.id)}
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </motion.button>
        <div className="absolute bottom-3 left-3">
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {t(`categories.${item.category}`)}
          </span>
        </div>
      </div>

      <Link className="block p-5" href={`/${locale}/items/${item.id}`}>
        <h3 className="mb-2 line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {item.title}
        </h3>
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {item.summary ?? t("summaryFallback")}
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate font-semibold text-foreground/80">{item.source_name}</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="flex shrink-0 items-center gap-1">
              <Clock className="h-3 w-3" />
              {time}
            </span>
          </div>
          <SentimentBadge sentiment={sentiment} />
        </div>
      </Link>

      <ArrowUpRight className="absolute right-5 top-5 h-5 w-5 opacity-0 text-primary transition-opacity group-hover:opacity-100" />
    </motion.article>
  )
}

function ListNewsCard({
  item,
  index,
  isBookmarked,
  onToggleBookmark
}: {
  item: ItemSummary
  index: number
  isBookmarked: boolean
  onToggleBookmark: (id: string) => void
}) {
  const t = useTranslations("feed")
  const locale = useLocale()
  const ref = useRef(null)
  const isInView = useInView(ref, { margin: "-30px", once: true })
  const sentiment = inferSentiment(item)
  const time = useRelativeTime(item.published_at)

  return (
    <motion.article
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      className="group flex items-stretch overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
      initial={{ opacity: 0, y: 20 }}
      ref={ref}
      transition={{ delay: index * 0.03, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
    >
      <div className={cn("w-1 shrink-0 rounded-l-xl", stripeColors[item.category])} />
      <div className="flex flex-1 items-center gap-4 p-4">
        <Link className="min-w-0 flex-1" href={`/${locale}/items/${item.id}`}>
          <h3 className="mb-1 line-clamp-1 font-semibold text-foreground transition-colors group-hover:text-primary">
            {item.title}
          </h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">{item.summary ?? t("summaryFallback")}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">{item.source_name}</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{time}</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{t(`categories.${item.category}`)}</span>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-3">
          <SentimentBadge sentiment={sentiment} />
          <motion.button
            className={cn("rounded-xl p-2 transition-colors", isBookmarked ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            onClick={() => onToggleBookmark(item.id)}
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </motion.button>
        </div>
      </div>
    </motion.article>
  )
}

function LoadingSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <div className="animate-pulse overflow-hidden rounded-xl border border-border bg-card" key={key}>
            <div className="h-[120px] bg-muted" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((key) => (
        <div className="flex animate-pulse overflow-hidden rounded-xl border border-border bg-card" key={key}>
          <div className="w-1 bg-muted" />
          <div className="flex-1 space-y-2 p-4">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NewsPage() {
  const t = useTranslations("news")
  const feedT = useTranslations("feed")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<Category | "">("")
  const [activeMarket, setActiveMarket] = useState<Market | "">("")
  const [sortBy, setSortBy] = useState("latest")
  const [isFocused, setIsFocused] = useState(false)
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set())
  const loadMoreRef = useRef(null)
  const isLoadMoreInView = useInView(loadMoreRef, { margin: "100px" })
  const filters = useMemo<ItemFilters>(
    () => ({
      category: activeCategory || undefined,
      keyword: searchQuery.trim() || undefined,
      market: activeMarket || undefined,
      page_size: 18
    }),
    [activeCategory, activeMarket, searchQuery]
  )
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useItems(filters)
  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  useEffect(() => {
    if (isLoadMoreInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoadMoreInView])

  const handleToggleBookmark = useCallback((id: string) => {
    setBookmarked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <motion.div animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4" initial={{ opacity: 0, y: 20 }}>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          <motion.button
            className={cn("rounded-lg p-2.5 transition-all duration-200", viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setViewMode("grid")}
            type="button"
            whileTap={{ scale: 0.95 }}
          >
            <LayoutGrid className="h-4 w-4" />
          </motion.button>
          <motion.button
            className={cn("rounded-lg p-2.5 transition-all duration-200", viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setViewMode("list")}
            type="button"
            whileTap={{ scale: 0.95 }}
          >
            <List className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>

      <motion.div animate={{ opacity: 1, y: 0 }} className="relative" initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.1 }}>
        <Search className={cn("absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-200", isFocused ? "text-primary" : "text-muted-foreground")} />
        <input
          className={cn(
            "w-full rounded-xl border bg-card py-3.5 pl-12 pr-10 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground",
            isFocused ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40"
          )}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={t("searchPlaceholder")}
          type="text"
          value={searchQuery}
        />
        <AnimatePresence>
          {searchQuery && (
            <motion.button
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors hover:bg-muted"
              exit={{ opacity: 0, scale: 0.8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              onClick={() => setSearchQuery("")}
              type="button"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3" initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.15 }}>
        <div className="flex flex-wrap gap-2">
          {categoryFilters.map((category) => (
            <motion.button
              className={cn("rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200", activeCategory === category ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground")}
              key={category || "all"}
              onClick={() => setActiveCategory(category)}
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              {category ? feedT(`categories.${category}`) : feedT("all")}
            </motion.button>
          ))}
        </div>
        <div className="hidden h-6 w-px bg-border sm:block" />
        <div className="flex flex-wrap gap-2">
          {marketFilters.map((market) => (
            <motion.button
              className={cn("rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200", activeMarket === market ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground")}
              key={market || "all-markets"}
              onClick={() => setActiveMarket(market)}
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              {market ? feedT(`markets.${market}`) : t("allMarkets")}
            </motion.button>
          ))}
        </div>
        <div className="ml-auto">
          <CustomSelect
            onChange={setSortBy}
            options={sortOptions.map((option) => ({ label: t(`sort.${option}`), value: option }))}
            value={sortBy}
          />
        </div>
      </motion.div>

      {isLoading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {feedT("empty")}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === "grid" ? (
            <motion.div animate={{ opacity: 1 }} className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="grid">
              {items.map((item, index) => (
                <GridNewsCard index={index} isBookmarked={bookmarked.has(item.id)} item={item} key={item.id} onToggleBookmark={handleToggleBookmark} />
              ))}
            </motion.div>
          ) : (
            <motion.div animate={{ opacity: 1 }} className="space-y-3" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="list">
              {items.map((item, index) => (
                <ListNewsCard index={index} isBookmarked={bookmarked.has(item.id)} item={item} key={item.id} onToggleBookmark={handleToggleBookmark} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="py-8" ref={loadMoreRef}>
        {isFetchingNextPage && <LoadingSkeleton viewMode={viewMode} />}
        <motion.div animate={{ opacity: 1 }} className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground" initial={{ opacity: 0 }}>
          {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{t("showing", { shown: items.length, total })}</span>
        </motion.div>
      </div>
    </div>
  )
}
