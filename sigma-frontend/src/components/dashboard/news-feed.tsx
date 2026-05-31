"use client";

import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { NewsCard } from "@/components/dashboard/news-card";
import { useItems, useItemsPaginated } from "@/hooks/useItems";
import type { ItemFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LoadingGridProps {
  count?: number;
}

interface PaginationBarProps {
  currentPage: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  totalPages: number;
}

interface FeedProps {
  filters: ItemFilters;
}

interface NewsFeedProps extends FeedProps {
  paginated?: boolean;
}

function LoadingGrid({ count = 6 }: LoadingGridProps) {
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
}: PaginationBarProps) {
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

function InfiniteNewsFeed({ filters }: FeedProps) {
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

function PaginatedNewsFeed({ filters }: FeedProps) {
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

export function NewsFeed({ filters, paginated = false }: NewsFeedProps) {
  if (paginated) {
    return <PaginatedNewsFeed filters={filters} />;
  }

  return <InfiniteNewsFeed filters={filters} />;
}
