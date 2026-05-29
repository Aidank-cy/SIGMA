"use client";

import { motion, useInView } from "framer-motion";
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useItems, useItemsPaginated } from "@/hooks/useItems";
import type { Category, ItemFilters, ItemSummary, Sentiment } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryGradients: Record<Category, string> = {
  finance: "from-emerald-600/80 via-emerald-500/60 to-emerald-400/40",
  macro: "from-amber-500/80 via-amber-400/60 to-amber-300/40",
  other: "from-slate-600/80 via-slate-500/60 to-slate-400/40",
  politics: "from-indigo-600/80 via-indigo-500/60 to-indigo-400/40",
  technology: "from-purple-600/80 via-purple-500/60 to-purple-400/40"
};

function inferSentiment(item: ItemSummary): Sentiment {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  if (/\b(drop|fall|risk|warning|slump|cut|loss|bear)\b/.test(text)) return "bearish";
  if (/\b(rise|gain|growth|rally|strong|beat|bull)\b/.test(text)) return "bullish";
  return "neutral";
}

function relativeTime(value: string, locale: string): string {
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return formatter.format(diffSeconds, "second");
}

function NewsCard({
  bookmarked,
  index,
  item,
  onToggleBookmark
}: {
  bookmarked: boolean;
  index: number;
  item: ItemSummary;
  onToggleBookmark: (itemId: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("feed");
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-50px", once: true });
  const sentiment = inferSentiment(item);

  return (
    <motion.article
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      initial={{ opacity: 0, y: 40 }}
      ref={ref}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
    >
      <div className={cn("relative h-44 overflow-hidden bg-gradient-to-br", categoryGradients[item.category])}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              sentiment === "bullish"
                ? "bg-chart-1/25 text-chart-1"
                : sentiment === "bearish"
                  ? "bg-chart-2/25 text-chart-2"
                  : "bg-white/20 text-white"
            )}
          >
            {t(`categories.${item.category}`)}
          </span>
          <motion.button
            aria-label="Bookmark"
            className={cn(
              "rounded-full p-2 transition-colors",
              bookmarked ? "bg-primary/80 text-primary-foreground" : "bg-black/30 text-white hover:bg-white/30"
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleBookmark(item.id);
            }}
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Bookmark className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} />
          </motion.button>
        </div>
      </div>

      <div className="p-6">
        <Link href={`/${locale}/items/${item.id}`}>
          <h3 className="mb-2 line-clamp-2 font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
            {item.title}
          </h3>
        </Link>
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-foreground/60">
          {item.summary ?? t("summaryFallback")}
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-foreground/55">
            <span className="truncate font-bold text-foreground/80">{item.source_name || t("sourceFallback")}</span>
            <span className="text-foreground/35">|</span>
            <span className="flex shrink-0 items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(item.published_at, locale)}
            </span>
          </div>
          <Link
            aria-label={item.title}
            className="rounded-full p-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
            href={`/${locale}/items/${item.id}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" key={index} />
      ))}
    </div>
  );
}

function FeedHeader() {
  const t = useTranslations("dashboard");
  const locale = useLocale();

  return (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-xl font-bold text-foreground">{t("latestNews")}</h2>
      <Link className="flex items-center gap-1 text-sm font-bold text-primary hover:underline" href={`/${locale}/news`}>
        {t("viewAll")}
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function EmptyState() {
  const feedT = useTranslations("feed");

  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
      {feedT("empty")}
    </div>
  );
}

function getPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const windowSize = 5;
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - windowSize + 1));
  const end = Math.min(totalPages, start + windowSize - 1);
  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [];

  if (start > 1) {
    items.push(1);
    if (start > 2) {
      items.push("ellipsis-start");
    }
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      items.push("ellipsis-end");
    }
    items.push(totalPages);
  }

  return items;
}

function PaginationBar({
  currentPage,
  hasNext,
  onPageChange,
  totalPages
}: {
  currentPage: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  const t = useTranslations("pagination");
  const items = getPaginationItems(currentPage, totalPages);
  const previousDisabled = currentPage === 1;
  const nextDisabled = !hasNext;

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
  );
}

function InfiniteNewsFeed({ filters }: { filters: ItemFilters }) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useItems(filters);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const handleToggleBookmark = (itemId: string) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div>
      <FeedHeader />

      {isLoading ? (
        <LoadingGrid />
      ) : null}
      {!isLoading && items.length === 0 ? (
        <EmptyState />
      ) : null}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <NewsCard
            bookmarked={bookmarked.has(item.id)}
            index={index}
            item={item}
            key={item.id}
            onToggleBookmark={handleToggleBookmark}
          />
        ))}
      </div>
      <div ref={sentinelRef} />
      {isFetchingNextPage ? (
        <div className="mt-5">
          <LoadingGrid count={3} />
        </div>
      ) : null}
    </div>
  );
}

function PaginatedNewsFeed({ filters }: { filters: ItemFilters }) {
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isLoading } = useItemsPaginated(filters, currentPage);
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? filters.page_size ?? 20)));

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.category, filters.date_from, filters.date_to, filters.keyword, filters.market, filters.source_id]);

  const handleToggleBookmark = (itemId: string) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  return (
    <div>
      <FeedHeader />

      {isLoading ? <LoadingGrid /> : null}
      {!isLoading && items.length === 0 ? <EmptyState /> : null}
      {!isLoading && items.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <NewsCard
              bookmarked={bookmarked.has(item.id)}
              index={index}
              item={item}
              key={item.id}
              onToggleBookmark={handleToggleBookmark}
            />
          ))}
        </div>
      ) : null}
      <PaginationBar
        currentPage={currentPage}
        hasNext={data?.has_next ?? false}
        onPageChange={setCurrentPage}
        totalPages={totalPages}
      />
    </div>
  );
}

export function NewsFeed({ filters, paginated = false }: { filters: ItemFilters; paginated?: boolean }) {
  if (paginated) {
    return <PaginatedNewsFeed filters={filters} />;
  }

  return <InfiniteNewsFeed filters={filters} />;
}
