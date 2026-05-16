"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useReports } from "@/hooks/useReports";
import type { ReportType } from "@/lib/types";

const reportTypes = ["all", "daily", "weekly", "monthly"] as const;

type ReportFilter = (typeof reportTypes)[number];

export default function ReportsPage() {
  const t = useTranslations("reports");
  const locale = useLocale();
  const [filter, setFilter] = useState<ReportFilter>("all");
  const reportType = filter === "all" ? undefined : (filter as ReportType);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useReports(reportType);
  const reports = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-sigma-line pb-6">
        <div>
          <p className="text-sm font-medium uppercase text-sigma-accent">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-sigma-text sm:text-4xl">{t("title")}</h1>
        </div>
        <Tabs
          activeId={filter}
          items={reportTypes.map((item) => ({ id: item, label: t(`filters.${item}`) }))}
          onChange={(value) => setFilter(value as ReportFilter)}
        />
      </header>

      {isLoading ? <ReportGridSkeleton /> : null}
      {!isLoading && reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sigma-line p-10 text-center text-sigma-muted">
          {t("empty")}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Link href={`/${locale}/reports/${report.id}`} key={report.id}>
            <Card className="flex h-full flex-col gap-5 p-5" interactive>
              <div className="flex items-start justify-between gap-3">
                <Badge>{t(`types.${report.report_type}`)}</Badge>
                <FileText className="h-5 w-5 text-sigma-accent" aria-hidden />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <h2 className="line-clamp-2 text-lg font-semibold leading-7 text-sigma-text">{report.title}</h2>
                <p className="text-sm text-sigma-muted">
                  {t("scope", {
                    categories: report.category_scope.length || t("all"),
                    markets: report.market_scope.length || t("all")
                  })}
                </p>
              </div>
              <p className="text-sm text-sigma-muted">
                {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                  new Date(report.generated_at)
                )}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      {hasNextPage ? (
        <Button
          className="self-center"
          isLoading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
          variant="secondary"
        >
          {t("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}

function ReportGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton className="h-56 rounded-2xl" key={index} />
      ))}
    </div>
  );
}
