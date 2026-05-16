"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Filter, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { ItemCard } from "@/components/feed/ItemCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useItems } from "@/hooks/useItems";
import type { Category, ItemFilters, Market } from "@/lib/types";

const categories: Category[] = ["politics", "finance", "technology", "macro"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu"];
const views = ["timeline", "category", "market"] as const;

type HomeView = (typeof views)[number];

function isHomeView(value: string | null): value is HomeView {
  return value === "timeline" || value === "category" || value === "market";
}

export default function HomePage() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useTranslations("feed");
  const viewParam = params.get("view");
  const [view, setView] = useState<HomeView>(isHomeView(viewParam) ? viewParam : "timeline");
  const [category, setCategory] = useState<Category | "">("");
  const [market, setMarket] = useState<Market | "">("");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    router.replace(`?view=${view}`, { scroll: false });
  }, [router, view]);

  const filters = useMemo<ItemFilters>(
    () => ({
      category: category || undefined,
      keyword: keyword.trim() || undefined,
      market: market || undefined,
      page_size: 20
    }),
    [category, keyword, market]
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-sigma-line pb-6">
        <div>
          <p className="text-sm font-medium uppercase text-sigma-accent">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-sigma-text sm:text-4xl">{t("title")}</h1>
        </div>
        <Tabs
          activeId={view}
          items={views.map((item) => ({ id: item, label: t(`views.${item}`) }))}
          onChange={(nextView) => setView(nextView as HomeView)}
        />
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: 8 }}
          key={view}
          transition={{ duration: 0.22 }}
        >
          {view === "timeline" ? (
            <TimelineView
              category={category}
              filters={filters}
              keyword={keyword}
              market={market}
              setCategory={setCategory}
              setKeyword={setKeyword}
              setMarket={setMarket}
            />
          ) : null}
          {view === "category" ? (
            <SectionGrid
              dimension="category"
              values={categories}
              onViewMore={(value) => {
                setCategory(value as Category);
                setMarket("");
                setView("timeline");
              }}
            />
          ) : null}
          {view === "market" ? (
            <SectionGrid
              dimension="market"
              values={markets}
              onViewMore={(value) => {
                setMarket(value as Market);
                setCategory("");
                setView("timeline");
              }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

interface TimelineViewProps {
  category: Category | "";
  filters: ItemFilters;
  keyword: string;
  market: Market | "";
  setCategory: (value: Category | "") => void;
  setKeyword: (value: string) => void;
  setMarket: (value: Market | "") => void;
}

function TimelineView({
  category,
  filters,
  keyword,
  market,
  setCategory,
  setKeyword,
  setMarket
}: TimelineViewProps) {
  const t = useTranslations("feed");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useItems(filters);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-2xl border border-sigma-line bg-sigma-elevated p-3 md:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sigma-muted" />
          <input
            className="h-11 w-full rounded-full border border-sigma-line bg-sigma-bg pl-11 pr-4 text-sm text-sigma-text outline-none focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("search")}
            value={keyword}
          />
        </label>
        <FilterSelect
          label={t("categoryFilter")}
          onChange={(value) => setCategory(value as Category | "")}
          options={categories.map((value) => ({ label: t(`categories.${value}`), value }))}
          value={category}
        />
        <FilterSelect
          label={t("marketFilter")}
          onChange={(value) => setMarket(value as Market | "")}
          options={markets.map((value) => ({ label: t(`markets.${value}`), value }))}
          value={market}
        />
      </div>

      {isLoading ? <TimelineSkeleton /> : null}
      {!isLoading && items.length === 0 ? <EmptyState /> : null}
      {items.map((item, index) => (
        <ItemCard index={index} item={item} key={item.id} />
      ))}
      <div ref={sentinelRef} />
      {isFetchingNextPage ? <TimelineSkeleton rows={2} /> : null}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}

function FilterSelect({ label, onChange, options, value }: FilterSelectProps) {
  const t = useTranslations("feed");

  return (
    <label className="relative">
      <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sigma-muted" />
      <select
        aria-label={label}
        className="h-11 w-full appearance-none rounded-full border border-sigma-line bg-sigma-bg pl-11 pr-4 text-sm font-medium text-sigma-text outline-none focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{t("all")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface SectionGridProps {
  dimension: "category" | "market";
  onViewMore: (value: string) => void;
  values: Array<Category | Market>;
}

function SectionGrid({ dimension, onViewMore, values }: SectionGridProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {values.map((value) => (
        <FeedSection
          dimension={dimension}
          key={`${dimension}-${value}`}
          onViewMore={() => onViewMore(value)}
          value={value}
        />
      ))}
    </div>
  );
}

interface FeedSectionProps {
  dimension: "category" | "market";
  onViewMore: () => void;
  value: Category | Market;
}

function FeedSection({ dimension, onViewMore, value }: FeedSectionProps) {
  const t = useTranslations("feed");
  const filters = dimension === "category" ? { category: value as Category, page_size: 5 } : { market: value as Market, page_size: 5 };
  const { data, isLoading } = useItems(filters);
  const items = data?.pages[0]?.items ?? [];

  return (
    <section className="min-h-[360px] border-t border-sigma-line pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {dimension === "category" ? (
            <Badge category={value as Category}>{t(`categories.${value}`)}</Badge>
          ) : (
            <Badge market={value as Market}>{t(`markets.${value}`)}</Badge>
          )}
        </div>
        <Button onClick={onViewMore} size="sm" variant="ghost">
          {t("viewMore")}
        </Button>
      </div>
      {isLoading ? <TimelineSkeleton rows={3} /> : null}
      {!isLoading && items.length === 0 ? <EmptyState compact /> : null}
      {items.map((item, index) => (
        <ItemCard index={index} item={item} key={item.id} />
      ))}
    </section>
  );
}

function TimelineSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="space-y-3 border-b border-sigma-line py-5" key={index}>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("feed");

  return (
    <div className={compact ? "py-8 text-sm text-sigma-muted" : "rounded-2xl border border-dashed border-sigma-line p-10 text-center text-sigma-muted"}>
      {t("empty")}
    </div>
  );
}
