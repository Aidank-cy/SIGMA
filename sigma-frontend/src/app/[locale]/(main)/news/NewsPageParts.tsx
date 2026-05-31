"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { toggleMultiSelection } from "@/lib/selection"
import type { Category, ItemSummary, Market } from "@/lib/types"
import { cn } from "@/lib/utils"

import { ListNewsCard } from "./NewsListCard"

export function SearchPanel({
  isFocused,
  onFocusChange,
  onReset,
  onSearchChange,
  searchQuery
}: {
  isFocused: boolean
  onFocusChange: (focused: boolean) => void
  onReset: () => void
  onSearchChange: (value: string) => void
  searchQuery: string
}) {
  const t = useTranslations("news")

  return (
    <motion.div animate={{ opacity: 1, y: 0 }} className="relative" initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.1 }}>
      <Search className={cn("absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-200", isFocused ? "text-primary" : "text-muted-foreground")} />
      <input
        className={cn("w-full rounded-2xl border bg-card py-3.5 pl-12 pr-10 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground", isFocused ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40")}
        onBlur={() => onFocusChange(false)}
        onChange={(event) => onSearchChange(event.target.value)}
        onFocus={() => onFocusChange(true)}
        placeholder={t("searchPlaceholder")}
        type="text"
        value={searchQuery}
      />
      <AnimatePresence>
        {searchQuery && (
          <motion.button animate={{ opacity: 1, scale: 1 }} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors hover:bg-muted" exit={{ opacity: 0, scale: 0.8 }} initial={{ opacity: 0, scale: 0.8 }} onClick={onReset} type="button">
            <X className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FilterPanel({
  activeCategory,
  activeMarket,
  categoryFilters,
  marketFilters,
  onCategoryChange,
  onMarketChange,
  onSortChange,
  sortBy,
  sortOptions
}: {
  activeCategory: Category[]
  activeMarket: Market[]
  categoryFilters: Array<Category | "">
  marketFilters: Array<Market | "">
  onCategoryChange: (value: Category[]) => void
  onMarketChange: (value: Market[]) => void
  onSortChange: (value: string) => void
  sortBy: string
  sortOptions: readonly string[]
}) {
  const t = useTranslations("news")
  const feedT = useTranslations("feed")

  return (
    <motion.div animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3" initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.15 }}>
      <FilterButtons filters={categoryFilters} labelFor={(category) => category ? feedT(`categories.${category}`) : feedT("all")} onChange={onCategoryChange} selected={activeCategory} />
      <div className="hidden h-6 w-px bg-border sm:block" />
      <FilterButtons filters={marketFilters} labelFor={(market) => market ? feedT(`markets.${market}`) : t("allMarkets")} onChange={onMarketChange} selected={activeMarket} />
      <div className="ml-auto">
        <CustomSelect onChange={onSortChange} options={sortOptions.map((option) => ({ label: t(`sort.${option}`), value: option }))} value={sortBy} />
      </div>
    </motion.div>
  )
}

function FilterButtons<T extends string>({
  filters,
  labelFor,
  onChange,
  selected
}: {
  filters: Array<T | "">
  labelFor: (value: T | "") => string
  onChange: (value: T[]) => void
  selected: T[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <motion.button className={filterClassName(filter, selected)} key={filter || "all"} onClick={() => onChange(toggleMultiSelection(selected, filter, filters.filter((item) => item !== "").length))} type="button" whileTap={{ scale: 0.95 }}>
          {labelFor(filter)}
        </motion.button>
      ))}
    </div>
  )
}

function filterClassName<T extends string>(filter: T | "", selected: T[]) {
  const isActive = (filter === "" && selected.length === 0) || (filter !== "" && selected.includes(filter))
  return cn("rounded-2xl px-4 py-2 text-sm font-bold transition-all duration-200", isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground")
}

function CustomSelect({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
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
      <motion.button className={cn("flex min-h-11 items-center gap-2 rounded-2xl border bg-card px-4 py-2.5 text-sm font-bold transition-all duration-200", isOpen ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40")} onClick={() => setIsOpen((current) => !current)} type="button" whileTap={{ scale: 0.98 }}>
        <span className="text-foreground">{selectedOption?.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && <SelectOptions onChange={onChange} options={options} setIsOpen={setIsOpen} value={value} />}
      </AnimatePresence>
    </div>
  )
}

function SelectOptions({ onChange, options, setIsOpen, value }: { onChange: (value: string) => void; options: { value: string; label: string }[]; setIsOpen: (value: boolean) => void; value: string }) {
  return (
    <motion.div animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute left-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-sm" exit={{ opacity: 0, scale: 0.96, y: -8 }} initial={{ opacity: 0, scale: 0.96, y: -8 }} transition={{ duration: 0.15 }}>
      <div className="p-1">
        {options.map((option, index) => (
          <motion.button animate={{ opacity: 1, x: 0 }} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors", value === option.value ? "bg-primary/10 font-bold text-primary" : "text-foreground hover:bg-muted")} initial={{ opacity: 0, x: -10 }} key={option.value} onClick={() => { onChange(option.value); setIsOpen(false) }} transition={{ delay: index * 0.03 }} type="button">
            <span>{option.label}</span>
            {value === option.value && <Check className="h-4 w-4 text-primary" />}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

export function NewsResults({ feedEmpty, isLoading, items }: { feedEmpty: string; isLoading: boolean; items: ItemSummary[] }) {
  if (isLoading) {
    return <LoadingSkeleton />
  }
  if (items.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-foreground/60">{feedEmpty}</div>
  }
  return (
    <AnimatePresence mode="sync">
      <motion.div animate={{ opacity: 1 }} className="space-y-3" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="list">
        {items.map((item, index) => <ListNewsCard index={index} item={item} key={item.id} />)}
      </motion.div>
    </AnimatePresence>
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
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const windowSize = 5
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - windowSize + 1))
  const end = Math.min(totalPages, start + windowSize - 1)
  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = []
  if (start > 1) {
    items.push(1)
    if (start > 2) items.push("ellipsis-start")
  }
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < totalPages) {
    if (end < totalPages - 1) items.push("ellipsis-end")
    items.push(totalPages)
  }
  return items
}

export function PaginationBar({ currentPage, hasNext, onPageChange, totalPages }: { currentPage: number; hasNext: boolean; onPageChange: (page: number) => void; totalPages: number }) {
  const t = useTranslations("pagination")
  const items = getPaginationItems(currentPage, totalPages)
  const previousDisabled = currentPage === 1
  const nextDisabled = !hasNext

  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row">
      <p className="text-sm text-foreground/65">{t("pageOf", { current: currentPage, total: totalPages })}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className="inline-flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent" disabled={previousDisabled} onClick={() => onPageChange(Math.max(1, currentPage - 1))} type="button">
          <ChevronLeft className="h-4 w-4" />
          {t("previous")}
        </button>
        {items.map((item) => typeof item === "number" ? <PageButton currentPage={currentPage} item={item} key={item} onPageChange={onPageChange} /> : <span className="flex h-10 min-w-6 items-center justify-center text-sm font-bold text-muted-foreground" key={item}>...</span>)}
        <button className="inline-flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent" disabled={nextDisabled} onClick={() => onPageChange(currentPage + 1)} type="button">
          {t("next")}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function PageButton({ currentPage, item, onPageChange }: { currentPage: number; item: number; onPageChange: (page: number) => void }) {
  return (
    <button aria-current={item === currentPage ? "page" : undefined} className={cn("h-10 min-w-10 rounded-xl border px-3 text-sm font-bold transition-colors", item === currentPage ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted")} onClick={() => onPageChange(item)} type="button">
      {item}
    </button>
  )
}
