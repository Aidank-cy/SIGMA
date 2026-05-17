"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { SentimentBadge } from "@/components/feed/SentimentBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useItems } from "@/hooks/useItems";
import { cn } from "@/lib/cn";
import type { ItemDetail } from "@/lib/types";

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
        item.sentiment === "bullish" && "border-sigma-success/25 bg-sigma-success/10",
        item.sentiment === "bearish" && "border-sigma-danger/25 bg-sigma-danger/10",
        item.sentiment === "neutral" && "border-sigma-line bg-sigma-elevated"
      )}
    >
      <p className="text-xs font-medium text-sigma-muted">{t("sentiment")}</p>
      <div className="mt-3">
        <SentimentBadge sentiment={item.sentiment} />
      </div>
    </section>
  );
}

function KeywordsCard({ keywords }: { keywords: string[] }) {
  const t = useTranslations("itemDetail.sidebar");

  return (
    <section className="rounded-2xl border border-sigma-line bg-sigma-elevated p-4">
      <h2 className="text-sm font-semibold text-sigma-text">{t("keywords")}</h2>
      {keywords.length === 0 ? <p className="mt-3 text-sm text-sigma-muted">{t("empty")}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <span className="rounded-full bg-sigma-accent/12 px-3 py-1 text-xs font-semibold text-sigma-text" key={keyword}>
            {keyword}
          </span>
        ))}
      </div>
    </section>
  );
}

function MoreFromSource({ item }: { item: ItemDetail }) {
  const locale = useLocale();
  const t = useTranslations("itemDetail.sidebar");
  const { data, isLoading } = useItems({ page_size: 3, source_id: item.source_id });
  const items = (data?.pages[0]?.items ?? []).filter((candidate) => candidate.id !== item.id).slice(0, 3);

  return (
    <section className="rounded-2xl border border-sigma-line bg-sigma-surface p-4">
      <h2 className="text-sm font-semibold text-sigma-text">{t("moreFromSource")}</h2>
      {isLoading ? <Skeleton className="mt-3 h-24 rounded-xl" /> : null}
      {!isLoading && items.length === 0 ? <p className="mt-3 text-sm text-sigma-muted">{t("empty")}</p> : null}
      <div className="mt-3 space-y-3">
        {items.map((sourceItem) => (
          <Link
            className="block text-sm font-medium leading-6 text-sigma-text hover:text-sigma-accent"
            href={`/${locale}/items/${sourceItem.id}`}
            key={sourceItem.id}
          >
            {sourceItem.title}
          </Link>
        ))}
      </div>
    </section>
  );
}
