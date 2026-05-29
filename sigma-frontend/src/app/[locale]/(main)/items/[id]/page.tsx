"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ItemSidebar } from "@/components/feed/ItemSidebar";
import { RawContent } from "@/components/feed/RawContent";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useItem } from "@/hooks/useItems";
import type { MinimalItem } from "@/lib/types";

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
    return <div className="rounded-2xl border border-dashed border-border p-10 text-muted-foreground">{t("empty")}</div>;
  }

  const isMetadataOnly = item.content_raw.startsWith(item.title)
    && (item.content_raw.includes("Release date:") || item.content_raw.includes("Source:"));

  return (
    <article className="grid gap-8 p-6 lg:grid-cols-[1fr_280px] lg:p-8">
      <div className="min-w-0">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href={`/${locale}`}>
            {t("breadcrumbHome")}
          </Link>
          <span>/</span>
          <span>{t("breadcrumbCurrent")}</span>
        </nav>

        <header className="mt-8 flex flex-col gap-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-foreground">{item.source_name}</span>
            <Badge category={item.category}>{t(`categories.${item.category}`)}</Badge>
            <Badge market={item.market}>{t(`markets.${item.market}`)}</Badge>
            <span className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(item.published_at)
              )}
            </span>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">{item.title}</h1>
        </header>

        <div className="mt-8 flex flex-col gap-8">
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-foreground">{t("summaryTitle")}</h2>
              {item.content_url ? (
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
                  href={item.content_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("original")}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </div>
            <p className="text-base leading-7 text-muted-foreground">{item.summary ?? t("summaryFallback")}</p>
          </Card>

          <section className="border-t border-border pt-5">
            <button
              className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
              onClick={() => setIsRawOpen((current) => !current)}
              type="button"
            >
              <span className="text-lg font-bold text-foreground">{t("rawTitle")}</span>
              <ChevronDown className={isRawOpen ? "h-5 w-5 rotate-180 text-muted-foreground" : "h-5 w-5 text-muted-foreground"} />
            </button>
            {isRawOpen ? (
              <div className="mt-5 rounded-2xl border border-border bg-card p-6">
                {isMetadataOnly ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm leading-6 text-muted-foreground">{t("metadataOnly")}</p>
                    {item.content_url ? (
                      <Link
                        className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-bold text-background shadow-sm transition-all duration-200 hover:brightness-110"
                        href={item.content_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t("originalSource")}
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <RawContent content={item.content_raw} />
                )}
              </div>
            ) : null}
          </section>

          <section className="border-t border-border pt-5">
            <h2 className="mb-3 text-lg font-bold text-foreground">{t("relatedTitle")}</h2>
            {item.related.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("relatedEmpty")}</p>
            ) : (
              <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
                {item.related.map((related, index) => (
                  <div className="min-w-[260px] max-w-[300px] snap-start" key={related.id}>
                    <RelatedItemCard index={index} item={related} locale={locale} />
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

function RelatedItemCard({ index, item, locale }: { index: number; item: MinimalItem; locale: string }) {
  return (
    <Link
      className="block h-full rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      href={`/${locale}/items/${item.id}`}
      style={{ transitionDelay: `${index * 20}ms` }}
    >
      <p className="line-clamp-3 text-sm font-bold text-foreground">{item.title}</p>
      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 p-6 lg:grid-cols-[1fr_280px] lg:p-8">
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
