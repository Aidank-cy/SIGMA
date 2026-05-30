"use client"

import { AnimatePresence, motion, useInView } from "framer-motion"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Search, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import { useItemsPaginated } from "@/hooks/useItems"
import { toggleMultiSelection } from "@/lib/selection"
import { cn } from "@/lib/utils"
import type { Category, ItemFilters, ItemSummary, Market, Sentiment } from "@/lib/types"

const categoryFilters: Array<Category | ""> = ["", "politics", "finance", "technology", "macro"]
const marketFilters: Array<Market | ""> = ["", "us", "cn", "hk", "jp", "eu", "kr", "tw"]
const sortOptions = ["latest", "relevant", "discussed"] as const
const validCategories = new Set<Category>(["politics", "finance", "technology", "macro", "other"])
const validMarkets = new Set<Market>(["us", "cn", "hk", "jp", "eu", "kr", "tw"])

const stripeColors: Record<Category, string> = {
  finance: "bg-chart-1",
  macro: "bg-chart-5",
  other: "bg-muted-foreground",
  politics: "bg-chart-3",
  technology: "bg-chart-4"
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
          "flex min-h-11 items-center gap-2 rounded-2xl border bg-card px-4 py-2.5 text-sm font-bold transition-all duration-200",
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
            className="absolute left-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-sm"
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-1">
              {options.map((option, index) => (
                <motion.button
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    value === option.value ? "bg-primary/10 font-bold text-primary" : "text-foreground hover:bg-muted"
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
        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold",
        sentiment === "bullish" ? "bg-chart-1/10 text-chart-1" : sentiment === "bearish" ? "bg-chart-2/10 text-chart-2" : "bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", sentiment === "bullish" ? "bg-chart-1" : sentiment === "bearish" ? "bg-chart-2" : "bg-muted-foreground")} />
      {t(sentiment)}
    </span>
  )
}

function ListNewsCard({
  item,
  index
}: {
  item: ItemSummary
  index: number
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
      className="group flex items-stretch overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      initial={{ opacity: 0, y: 20 }}
      ref={ref}
      transition={{ delay: index * 0.03, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
    >
      <div className={cn("w-1 shrink-0 rounded-l-2xl", stripeColors[item.category])} />
      <div className="flex flex-1 items-center gap-4 p-6">
        <Link className="min-w-0 flex-1" href={`/${locale}/items/${item.id}`}>
          <h3 className="mb-1 line-clamp-1 font-bold text-foreground transition-colors group-hover:text-primary">
            {item.title}
          </h3>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((key) => (
        <div className="flex animate-pulse overflow-hidden rounded-2xl border border-border bg-card" key={key}>
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

function getPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const windowSize = 5
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - windowSize + 1))
  const end = Math.min(totalPages, start + windowSize - 1)
  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = []

  if (start > 1) {
    items.push(1)
    if (start > 2) {
      items.push("ellipsis-start")
    }
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page)
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      items.push("ellipsis-end")
    }
    items.push(totalPages)
  }

  return items
}

function PaginationBar({
  currentPage,
  hasNext,
  onPageChange,
  totalPages
}: {
  currentPage: number
  hasNext: boolean
  onPageChange: (page: number) => void
  totalPages: number
}) {
  const t = useTranslations("pagination")
  const items = getPaginationItems(currentPage, totalPages)
  const previousDisabled = currentPage === 1
  const nextDisabled = !hasNext

  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row">
      <p className="text-sm text-foreground/65">{t("pageOf", { current: currentPage, total: totalPages })}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
          disabled={previousDisabled}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("previous")}
        </button>
        {items.map((item) =>
          typeof item === "number" ? (
            <button
              aria-current={item === currentPage ? "page" : undefined}
              className={cn(
                "h-10 min-w-10 rounded-xl border px-3 text-sm font-bold transition-colors",
                item === currentPage
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-muted"
              )}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          ) : (
            <span className="flex h-10 min-w-6 items-center justify-center text-sm font-bold text-muted-foreground" key={item}>
              ...
            </span>
          )
        )}
        <button
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
          disabled={nextDisabled}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          {t("next")}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function parseCategoriesParam(value: string): Category[] {
  return value.split(",").filter((category): category is Category => validCategories.has(category as Category))
}

function parseMarketsParam(value: string): Market[] {
  return value.split(",").filter((market): market is Market => validMarkets.has(market as Market))
}

function parsePageParam(value: string): number {
  const page = Number.parseInt(value, 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function NewsPageContent() {
  const t = useTranslations("news")
  const feedT = useTranslations("feed")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const keywordParam = searchParams.get("keyword") ?? ""
  const categoryParam = searchParams.get("category") ?? ""
  const marketParam = searchParams.get("market") ?? ""
  const pageParam = searchParams.get("page") ?? ""
  const dateFromParam = searchParams.get("date_from") ?? undefined
  const [searchQuery, setSearchQuery] = useState(() => keywordParam)
  const [activeCategory, setActiveCategory] = useState<Category[]>(() => parseCategoriesParam(categoryParam))
  const [activeMarket, setActiveMarket] = useState<Market[]>(() => parseMarketsParam(marketParam))
  const [sortBy, setSortBy] = useState("latest")
  const [isFocused, setIsFocused] = useState(false)
  const [currentPage, setCurrentPage] = useState(() => parsePageParam(pageParam))
  const categoryKey = activeCategory.join(",")
  const marketKey = activeMarket.join(",")
  const filters = useMemo<ItemFilters>(
    () => ({
      category: activeCategory.length > 0 ? activeCategory.join(",") : undefined,
      date_from: dateFromParam,
      keyword: searchQuery.trim() || undefined,
      market: activeMarket.length > 0 ? activeMarket.join(",") : undefined,
      page_size: 10
    }),
    [activeCategory, activeMarket, dateFromParam, searchQuery]
  )
  const { data, isLoading } = useItemsPaginated(filters, currentPage)
  const items = data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? filters.page_size ?? 10)))

  useEffect(() => {
    setSearchQuery(keywordParam)
    setActiveCategory(parseCategoriesParam(categoryParam))
    setActiveMarket(parseMarketsParam(marketParam))
    setCurrentPage(parsePageParam(pageParam))
  }, [categoryParam, keywordParam, marketParam, pageParam])

  useEffect(() => {
    const params = new URLSearchParams()
    if (categoryKey) {
      params.set("category", categoryKey)
    }
    if (marketKey) {
      params.set("market", marketKey)
    }
    if (searchQuery.trim()) {
      params.set("keyword", searchQuery.trim())
    }
    if (dateFromParam) {
      params.set("date_from", dateFromParam)
    }
    if (currentPage > 1) {
      params.set("page", String(currentPage))
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }, [categoryKey, currentPage, dateFromParam, marketKey, pathname, router, searchQuery])

  function resetToFirstPage() {
    setCurrentPage(1)
    window.scrollTo(0, 0)
  }

  function handlePageChange(page: number) {
    setCurrentPage(page)
    window.scrollTo(0, 0)
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }}>
        <div>
          <h1 className="text-[32px] font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
      </motion.div>

      <motion.div animate={{ opacity: 1, y: 0 }} className="relative" initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.1 }}>
        <Search className={cn("absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-200", isFocused ? "text-primary" : "text-muted-foreground")} />
        <input
          className={cn(
            "w-full rounded-2xl border bg-card py-3.5 pl-12 pr-10 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground",
            isFocused ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40"
          )}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => {
            setSearchQuery(event.target.value)
            setCurrentPage(1)
          }}
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
              onClick={() => {
                setSearchQuery("")
                resetToFirstPage()
              }}
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
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-bold transition-all duration-200",
                (category === "" && activeCategory.length === 0) || (category !== "" && activeCategory.includes(category))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
              key={category || "all"}
              onClick={() => {
                setActiveCategory((current) =>
                  toggleMultiSelection(current, category, categoryFilters.filter((item) => item !== "").length)
                )
                resetToFirstPage()
              }}
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
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-bold transition-all duration-200",
                (market === "" && activeMarket.length === 0) || (market !== "" && activeMarket.includes(market))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
              key={market || "all-markets"}
              onClick={() => {
                setActiveMarket((current) =>
                  toggleMultiSelection(current, market, marketFilters.filter((item) => item !== "").length)
                )
                resetToFirstPage()
              }}
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
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-foreground/60">
          {feedT("empty")}
        </div>
      ) : (
        <AnimatePresence mode="sync">
          <motion.div animate={{ opacity: 1 }} className="space-y-3" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="list">
            {items.map((item, index) => (
              <ListNewsCard index={index} item={item} key={item.id} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <PaginationBar
        currentPage={currentPage}
        hasNext={data?.has_next ?? false}
        onPageChange={handlePageChange}
        totalPages={totalPages}
      />
    </div>
  )
}
