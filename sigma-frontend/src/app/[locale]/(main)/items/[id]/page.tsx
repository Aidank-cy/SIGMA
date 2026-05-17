"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ItemCard } from "@/components/feed/ItemCard";
import { ItemSidebar } from "@/components/feed/ItemSidebar";
import { RawContent } from "@/components/feed/RawContent";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useItem } from "@/hooks/useItems";

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations("itemDetail");
  const [isRawOpen, setIsRawOpen] = useState(false);
  const { data: item, isLoading } = useItem(params.id);

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!item) {
    return <div className="rounded-2xl border border-dashed border-sigma-line p-10 text-sigma-muted">{t("empty")}</div>;
  }

  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <nav className="flex items-center gap-2 text-sm text-sigma-muted">
          <Link className="hover:text-sigma-text" href={`/${locale}`}>
            {t("breadcrumbHome")}
          </Link>
          <span>/</span>
          <span>{t("breadcrumbCurrent")}</span>
        </nav>

        <header className="mt-8 flex flex-col gap-4 border-b border-sigma-line pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-sigma-text">{item.source_name}</span>
            <Badge category={item.category}>{t(`categories.${item.category}`)}</Badge>
            <Badge market={item.market}>{t(`markets.${item.market}`)}</Badge>
            <span className="text-sm text-sigma-muted">
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(item.published_at)
              )}
            </span>
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-sigma-text sm:text-5xl">{item.title}</h1>
        </header>

        <div className="mt-8 flex flex-col gap-8">
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-sigma-text">{t("summaryTitle")}</h2>
              {item.content_url ? (
                <Link
                  className="inline-flex items-center gap-2 text-sm font-medium text-sigma-accent"
                  href={item.content_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("original")}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </div>
            <p className="text-base leading-7 text-sigma-muted">{item.summary ?? t("summaryFallback")}</p>
          </Card>

          <section className="border-t border-sigma-line pt-5">
            <button
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setIsRawOpen((current) => !current)}
              type="button"
            >
              <span className="text-lg font-semibold text-sigma-text">{t("rawTitle")}</span>
              <ChevronDown className={isRawOpen ? "h-5 w-5 rotate-180 text-sigma-muted" : "h-5 w-5 text-sigma-muted"} />
            </button>
            {isRawOpen ? (
              <div className="mt-5 rounded-2xl border border-sigma-line bg-sigma-elevated p-5">
                <RawContent content={item.content_raw} />
              </div>
            ) : null}
          </section>

          <section className="border-t border-sigma-line pt-5">
            <h2 className="mb-3 text-lg font-semibold text-sigma-text">{t("relatedTitle")}</h2>
            {item.related.length === 0 ? (
              <p className="text-sm text-sigma-muted">{t("relatedEmpty")}</p>
            ) : (
              <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
                {item.related.map((related, index) => (
                  <div className="min-w-[260px] max-w-[300px] snap-start" key={related.id}>
                    <ItemCard index={index} item={related} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <ItemSidebar item={item} />
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <Skeleton className="hidden h-80 rounded-2xl lg:block" />
    </div>
  );
}
