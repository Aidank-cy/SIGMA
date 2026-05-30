"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { useItemsPaginated } from "@/hooks/useItems";
import { sortByPublishedAt } from "@/lib/utils";
import type { Category, ItemFilters, ItemSummary } from "@/lib/types";

type DashboardNewsColumnKey = "politics" | "economy" | "finance" | "macro";

const dashboardNewsColumns: Array<{ category: Category; key: DashboardNewsColumnKey }> = [
  { category: "politics", key: "politics" },
  { category: "technology", key: "economy" },
  { category: "finance", key: "finance" },
  { category: "macro", key: "macro" }
];

interface DashboardNewsByCategoryProps {
  baseFilters: ItemFilters;
}

interface DashboardNewsColumnProps {
  category: Category;
  isLoading: boolean;
  items: ItemSummary[];
  title: string;
}

export function DashboardNewsByCategory({ baseFilters }: DashboardNewsByCategoryProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const politics = useItemsPaginated({ ...baseFilters, category: "politics", page_size: 4 }, 1);
  const economy = useItemsPaginated({ ...baseFilters, category: "technology", page_size: 4 }, 1);
  const finance = useItemsPaginated({ ...baseFilters, category: "finance", page_size: 4 }, 1);
  const macro = useItemsPaginated({ ...baseFilters, category: "macro", page_size: 4 }, 1);
  const queries = { economy, finance, macro, politics };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-bold text-foreground">{t("latestNews")}</h2>
        <Link className="flex items-center gap-1 text-sm font-bold text-primary hover:underline" href={`/${locale}/news`}>
          {t("viewAll")}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {dashboardNewsColumns.map((column) => (
          <DashboardNewsColumn
            category={column.category}
            isLoading={queries[column.key].isLoading}
            items={sortByPublishedAt(queries[column.key].data?.items ?? []).slice(0, 4)}
            key={column.key}
            title={t(`newsColumns.${column.key}`)}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardNewsColumn({ category, isLoading, items, title }: DashboardNewsColumnProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const feedT = useTranslations("feed");

  return (
    <div className="flex min-h-[260px] flex-col rounded-2xl border border-border bg-card p-6">
      <h3 className="mb-3 text-[15px] font-bold text-foreground">{title}</h3>
      <div className="flex flex-1 flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="h-10 animate-pulse rounded-xl bg-muted" key={index} />
          ))
        ) : items.length > 0 ? (
          items.map((item) => (
            <Link
              className="rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-[15px] text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              href={`/${locale}/items/${item.id}`}
              key={item.id}
            >
              <span className="block line-clamp-1">{item.title}</span>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">{feedT("empty")}</p>
        )}
      </div>
      <Link
        className="mt-4 self-end text-sm font-bold text-primary hover:underline"
        href={`/${locale}/news?category=${category}`}
      >
        {t("viewDetails")}
      </Link>
    </div>
  );
}
