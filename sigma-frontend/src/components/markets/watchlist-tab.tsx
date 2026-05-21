"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { motion } from "framer-motion"
import { Star, Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { useWatchlistMutations, useWatchlists } from "@/hooks/useWatchlists"
import type { Watchlist } from "@/lib/types"

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

export function WatchlistTab() {
  const t = useTranslations("markets")
  const feedT = useTranslations("feed")
  const { data, isLoading } = useWatchlists()
  const { createWatchlist } = useWatchlistMutations()
  const watchlists = data?.items ?? []
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [keywords, setKeywords] = useState("")
  const [name, setName] = useState("")
  const [starred, setStarred] = useState<Set<string>>(new Set())
  const [submitError, setSubmitError] = useState("")

  const toggleStar = (symbol: string) => {
    const newStarred = new Set(starred)
    if (newStarred.has(symbol)) {
      newStarred.delete(symbol)
    } else {
      newStarred.add(symbol)
    }
    setStarred(newStarred)
  }

  const resetForm = () => {
    setKeywords("")
    setName("")
    setSubmitError("")
  }

  const closeCreateModal = () => {
    if (createWatchlist.isPending) {
      return
    }
    setIsCreateOpen(false)
    resetForm()
  }

  const parsedKeywords = keywords
    .split(/[\n,]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)

  const handleCreateWatchlist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError("")
    if (!name.trim() || parsedKeywords.length === 0) {
      setSubmitError(t("watchlistCreateRequired"))
      return
    }

    try {
      await createWatchlist.mutateAsync({
        keywords: parsedKeywords,
        markets: [],
        name: name.trim(),
        sources: []
      })
      setIsCreateOpen(false)
      resetForm()
    } catch {
      setSubmitError(t("watchlistCreateError"))
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("watchlistCount", { count: watchlists.length })}
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setIsCreateOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4" />
          {t("addWatchlist")}
        </motion.button>
      </div>

      {/* Stock List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="h-20 animate-pulse rounded-xl bg-muted/50" key={index} />
          ))}
        </div>
      ) : watchlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("emptyWatchlist")}
        </div>
      ) : (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        {watchlists.map((watchlist: Watchlist) => {
          const isStarred = starred.has(watchlist.id)

          return (
            <motion.div
              key={watchlist.id}
              variants={itemVariants}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
            >
              {/* Symbol & Name */}
              <div className="min-w-[140px]">
                <p className="font-bold text-foreground">{watchlist.name}</p>
                <p className="text-sm text-muted-foreground">
                  {watchlist.markets.map((market) => feedT(`markets.${market}`)).join(", ") || t("allMarkets")}
                </p>
              </div>

              {/* Price */}
              <div className="min-w-[100px] text-right">
                <p className="font-bold tabular-nums text-foreground">
                  {watchlist.item_count}
                </p>
                <p className="text-xs text-muted-foreground">{t("items")}</p>
              </div>

              {/* Change Badge */}
              <div className="min-w-[80px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {t("keywordCount", { count: watchlist.keywords.length })}
                </span>
              </div>

              <div className="flex flex-1 justify-center">
                <span className="text-xs font-medium text-muted-foreground">{t("notAvailable")}</span>
              </div>

              {/* Star Button */}
              <motion.button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleStar(watchlist.id)
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-lg transition-colors ${
                  isStarred
                    ? "text-chart-4"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star
                  className="w-5 h-5"
                  fill={isStarred ? "currentColor" : "none"}
                />
              </motion.button>
            </motion.div>
          )
        })}
      </motion.div>
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label={t("watchlistCreateClose")}
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={closeCreateModal}
            type="button"
          />
          <motion.form
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-modal="true"
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            onSubmit={handleCreateWatchlist}
            role="dialog"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t("watchlistCreateTitle")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("watchlistCreateDescription")}</p>
              </div>
              <button
                aria-label={t("watchlistCreateClose")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={closeCreateModal}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">{t("watchlistNameLabel")}</span>
                <input
                  className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("watchlistNamePlaceholder")}
                  value={name}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">{t("watchlistKeywordsLabel")}</span>
                <textarea
                  className="min-h-28 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder={t("watchlistKeywordsPlaceholder")}
                  value={keywords}
                />
              </label>

              {submitError ? <p className="text-sm font-medium text-chart-2">{submitError}</p> : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                disabled={createWatchlist.isPending}
                onClick={closeCreateModal}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-55"
                disabled={createWatchlist.isPending}
                type="submit"
              >
                {createWatchlist.isPending ? t("creating") : t("createWatchlist")}
              </button>
            </div>
          </motion.form>
        </div>
      ) : null}
    </div>
  )
}
