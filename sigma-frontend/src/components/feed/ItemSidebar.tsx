"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";

import { SentimentBadge } from "@/components/feed/SentimentBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useItems } from "@/hooks/useItems";
import { cn } from "@/lib/cn";
import type { ItemDetail, ItemSummary } from "@/lib/types";

interface ItemSidebarProps {
  item: ItemDetail;
}

export function ItemSidebar({ item }: ItemSidebarProps) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
      <SentimentCard item={item} />
      <KeywordsCard keywords={item.keywords} />
      <MoreFromSource item={item} />
    </aside>
  );
}

function SentimentCard({ item }: { item: ItemDetail }) {
  const t = useTranslations("itemDetail.sidebar");

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        item.sentiment === "bullish" && "border-chart-1/25 bg-chart-1/10",
        item.sentiment === "bearish" && "border-destructive/25 bg-destructive/10",
        item.sentiment === "neutral" && "border-border bg-card"
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{t("sentiment")}</p>
      <div className="mt-3">
        <SentimentBadge sentiment={item.sentiment} />
      </div>
    </section>
  );
}

function KeywordsCard({ keywords }: { keywords: string[] }) {
  const t = useTranslations("itemDetail.sidebar");

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t("keywords")}</h2>
      {keywords.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-foreground" key={keyword}>
            {keyword}
          </span>
        ))}
      </div>
    </section>
  );
}

function MoreFromSource({ item }: { item: ItemDetail }) {
  const t = useTranslations("itemDetail.sidebar");
  const locale = useLocale();
  const { data, isLoading } = useItems({ page_size: 3, source_id: item.source_id });
  const items = (data?.pages[0]?.items ?? []).filter((candidate) => candidate.id !== item.id).slice(0, 3);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t("moreFromSource")}</h2>
      {isLoading ? <Skeleton className="mt-3 h-24 rounded-xl" /> : null}
      {!isLoading && items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p> : null}
      <div className="mt-3 divide-y divide-border">
        {items.map((sourceItem, index) => (
          <SourceItemLink index={index} item={sourceItem} key={sourceItem.id} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function SourceItemLink({ index, item, locale }: { index: number; item: ItemSummary; locale: string }) {
  return (
    <Link
      className="block min-h-11 py-3 text-sm transition-colors hover:text-primary"
      href={`/${locale}/items/${item.id}`}
      style={{ transitionDelay: `${index * 20}ms` }}
    >
      <span className="line-clamp-2 font-medium text-foreground">{item.title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{item.source_name}</span>
    </Link>
  );
}
