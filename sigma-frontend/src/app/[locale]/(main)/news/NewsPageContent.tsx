"use client"

import { motion } from "framer-motion"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import { FilterPanel, NewsResults, PaginationBar, SearchPanel } from "./NewsPageParts"
import { useItemsPaginated } from "@/hooks/useItems"
import type { Category, ItemFilters, Market } from "@/lib/types"

const categoryFilters: Array<Category | ""> = ["", "politics", "finance", "technology", "macro"]
const marketFilters: Array<Market | ""> = ["", "us", "cn", "hk", "jp", "eu", "kr", "tw"]
const sortOptions = ["latest", "relevant", "discussed"] as const
const validCategories = new Set<Category>(["politics", "finance", "technology", "macro", "other"])
const validMarkets = new Set<Market>(["us", "cn", "hk", "jp", "eu", "kr", "tw"])

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
  const filters = useMemo<ItemFilters>(() => ({
    category: activeCategory.length > 0 ? activeCategory.join(",") : undefined,
    date_from: dateFromParam,
    keyword: searchQuery.trim() || undefined,
    market: activeMarket.length > 0 ? activeMarket.join(",") : undefined,
    page_size: 10
  }), [activeCategory, activeMarket, dateFromParam, searchQuery])
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
    if (categoryKey) params.set("category", categoryKey)
    if (marketKey) params.set("market", marketKey)
    if (searchQuery.trim()) params.set("keyword", searchQuery.trim())
    if (dateFromParam) params.set("date_from", dateFromParam)
    if (currentPage > 1) params.set("page", String(currentPage))
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
      <SearchPanel isFocused={isFocused} onFocusChange={setIsFocused} onReset={() => { setSearchQuery(""); resetToFirstPage() }} onSearchChange={(value) => { setSearchQuery(value); setCurrentPage(1) }} searchQuery={searchQuery} />
      <FilterPanel activeCategory={activeCategory} activeMarket={activeMarket} categoryFilters={categoryFilters} marketFilters={marketFilters} onCategoryChange={(value) => { setActiveCategory(value); resetToFirstPage() }} onMarketChange={(value) => { setActiveMarket(value); resetToFirstPage() }} onSortChange={setSortBy} sortBy={sortBy} sortOptions={sortOptions} />
      <NewsResults feedEmpty={feedT("empty")} isLoading={isLoading} items={items} />
      <PaginationBar currentPage={currentPage} hasNext={data?.has_next ?? false} onPageChange={handlePageChange} totalPages={totalPages} />
    </div>
  )
}
