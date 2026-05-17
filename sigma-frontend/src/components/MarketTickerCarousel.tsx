"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Sparkline } from "@/components/ui/Sparkline";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import { cn } from "@/lib/cn";
import type { MarketIndex } from "@/lib/types";

const pageSize = 6;
const desktopPageHeight = 40;
const mobilePageHeight = 80;

export function MarketTickerCarousel() {
  const t = useTranslations("feed.ticker");
  const { data, isLoading } = useMarketIndices();
  const [activePage, setActivePage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pageHeight, setPageHeight] = useState(desktopPageHeight);
  const pages = useMemo(() => chunk(data?.indices ?? [], pageSize), [data?.indices]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const updateHeight = () => setPageHeight(media.matches ? desktopPageHeight : mobilePageHeight);
    updateHeight();
    media.addEventListener("change", updateHeight);
    return () => media.removeEventListener("change", updateHeight);
  }, []);

  useEffect(() => {
    if (pages.length <= 1) {
      setActivePage(0);
      return;
    }
    setActivePage((current) => Math.min(current, pages.length - 1));
  }, [pages.length]);

  useEffect(() => {
    if (isPaused || pages.length <= 1) {
      return;
    }
    const interval = window.setInterval(() => {
      setActivePage((current) => (current + 1) % pages.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isPaused, pages.length]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-sigma-line bg-sigma-surface p-3">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  if (pages.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-sigma-line bg-sigma-surface px-3 py-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="min-w-0 flex-1 overflow-hidden" style={{ height: pageHeight }}>
        <div
          className="transition-transform duration-500 ease-in-out"
          style={{ transform: `translateY(-${activePage * pageHeight}px)` }}
        >
          {pages.map((page, pageIndex) => (
            <div
              className="grid h-20 grid-cols-3 grid-rows-2 items-center gap-x-2 md:h-10 md:grid-cols-6 md:grid-rows-1"
              key={pageIndex}
            >
              {padPage(page, pageSize).map((index, itemIndex) =>
                index ? (
                  <TickerItem index={index} key={index.symbol} />
                ) : (
                  <div aria-hidden className="hidden md:block" key={`pad-${pageIndex}-${itemIndex}`} />
                )
              )}
            </div>
          ))}
        </div>
      </div>
      {pages.length > 1 ? (
        <div className="flex shrink-0 flex-col items-center justify-center gap-1">
          {pages.map((_, pageIndex) => (
            <button
              aria-label={t("page", { page: pageIndex + 1 })}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                activePage === pageIndex ? "bg-sigma-text" : "bg-sigma-line hover:bg-sigma-muted"
              )}
              key={pageIndex}
              onClick={() => setActivePage(pageIndex)}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TickerItem({ index }: { index: MarketIndex }) {
  const positive = index.change_pct >= 0;
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-1 text-[11px] sm:text-xs">
      <span className="truncate font-semibold text-sigma-text">{index.name}</span>
      <span className="hidden tabular-nums text-sigma-muted sm:inline">
        {index.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
      <span className={cn("shrink-0 tabular-nums", positive ? "text-sigma-success" : "text-sigma-danger")}>
        {positive ? "+" : "−"}
        {Math.abs(index.change_pct).toFixed(2)}%
      </span>
      <span className="hidden shrink-0 lg:inline">
        <Sparkline
          data={index.sparkline_24h.map((value) => ({ value }))}
          height={18}
          positive={positive}
          width={54}
        />
      </span>
    </div>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

function padPage<T>(items: T[], size: number): Array<T | null> {
  if (items.length >= size) {
    return items;
  }
  return [...items, ...Array.from<T | null>({ length: size - items.length }).fill(null)];
}
