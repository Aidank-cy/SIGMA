"use client";

import { ChevronDown, Printer } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useActiveToc } from "@/hooks/useActiveToc";
import { useReport } from "@/hooks/useReports";

interface TocItem {
  id: string;
  level: number;
  text: string;
}

const ReportMarkdown = dynamic(() => import("@/components/reports/ReportMarkdown"), {
  loading: () => <Skeleton className="h-96 w-full rounded-2xl" />,
  ssr: false
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractToc(markdown: string): TocItem[] {
  return markdown
    .split("\n")
    .map((line) => /^(#{2,3})\s+(.+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      id: slugify(match[2]),
      level: match[1].length,
      text: match[2]
    }));
}

function formatReportSubtitle(report: {
  generated_at: string;
  period_end: string;
  period_start: string;
  report_type: string;
}, locale: string, typeLabel: string): string {
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit"
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
  const startDate = new Date(report.period_start);
  const endDate = new Date(report.period_end);
  const startTime = timeFormatter.format(startDate);
  const endTime = timeFormatter.format(endDate);
  return `${typeLabel} | ${dateFormatter.format(startDate)} (${startTime}) to ${dateFormatter.format(endDate)} (${endTime})`;
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations("reportDetail");
  const [isTocOpen, setIsTocOpen] = useState(false);
  const { data: report, isLoading } = useReport(params.id);
  const toc = useMemo(() => extractToc(report?.content ?? ""), [report?.content]);
  const tocIds = useMemo(() => toc.map((item) => item.id), [toc]);
  const activeId = useActiveToc(tocIds);

  if (isLoading) {
    return <ReportDetailSkeleton />;
  }

  if (!report) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-muted-foreground">{t("empty")}</div>;
  }
  const typeLabel = t(`displayTypes.${report.report_type}`);

  return (
    <article className="grid gap-8 print:block lg:grid-cols-[220px_1fr]">
      <aside className="print:hidden">
        <div className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto border-r border-border pr-5 lg:block">
          <Toc activeId={activeId} items={toc} title={t("toc")} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 lg:hidden">
          <button
            className="flex min-h-11 w-full items-center justify-between text-sm font-semibold text-foreground"
            onClick={() => setIsTocOpen((current) => !current)}
            type="button"
          >
            {t("toc")}
            <ChevronDown className={isTocOpen ? "h-4 w-4 rotate-180" : "h-4 w-4"} aria-hidden />
          </button>
          {isTocOpen ? <div className="mt-3"><Toc activeId={activeId} items={toc} title={t("toc")} compact /></div> : null}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
            <Link className="hover:text-foreground" href={`/${locale}/analytics`}>
              {t("breadcrumbReports")}
            </Link>
            <span>/</span>
            <span>{t("breadcrumbCurrent")}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="h-auto px-3 py-1 text-base font-bold">{t(`types.${report.report_type}`)}</Badge>
            <span className="text-lg font-bold text-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
                new Date(report.generated_at)
              )}
            </span>
          </div>
          <p className="text-base text-muted-foreground">
            {formatReportSubtitle(report, locale, typeLabel)}
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
              {typeLabel}
            </h1>
            <Button className="print:hidden" onClick={() => window.print()} variant="secondary">
              <Printer className="h-4 w-4" aria-hidden />
              {t("print")}
            </Button>
          </div>
        </header>

        <div className="report-markdown text-foreground">
          <ReportMarkdown content={report.content} slugify={slugify} />
        </div>
      </div>
    </article>
  );
}

function Toc({
  activeId,
  compact = false,
  items,
  title
}: {
  activeId: string;
  compact?: boolean;
  items: TocItem[];
  title: string;
}) {
  const t = useTranslations("reportDetail");

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("tocEmpty")}</p>;
  }

  return (
    <nav aria-label={title} className="flex flex-col gap-2">
      {items.map((item) => (
        <a
          className={[
            "flex min-h-11 items-center border-l-2 py-1 transition",
            item.id === activeId
              ? "border-primary pl-3 text-sm font-semibold text-foreground"
              : "border-transparent pl-3 text-sm text-muted-foreground hover:text-foreground",
            item.level === 3 && !compact ? "ml-3" : "font-medium"
          ].join(" ")}
          href={`#${item.id}`}
          key={`${item.id}-${item.text}`}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );
}

function ReportDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <Skeleton className="hidden h-96 rounded-2xl lg:block" />
      <div className="space-y-5">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
