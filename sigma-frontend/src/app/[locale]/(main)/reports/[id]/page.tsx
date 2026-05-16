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

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations("reportDetail");
  const [isTocOpen, setIsTocOpen] = useState(false);
  const { data: report, isLoading } = useReport(params.id);
  const toc = useMemo(() => extractToc(report?.content ?? ""), [report?.content]);

  if (isLoading) {
    return <ReportDetailSkeleton />;
  }

  if (!report) {
    return <div className="rounded-2xl border border-dashed border-sigma-line p-10 text-sigma-muted">{t("empty")}</div>;
  }

  return (
    <article className="grid gap-8 print:block lg:grid-cols-[220px_1fr]">
      <aside className="print:hidden">
        <div className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto border-r border-sigma-line pr-5 lg:block">
          <Toc items={toc} title={t("toc")} />
        </div>
        <div className="rounded-2xl border border-sigma-line bg-sigma-elevated p-4 lg:hidden">
          <button
            className="flex w-full items-center justify-between text-sm font-semibold text-sigma-text"
            onClick={() => setIsTocOpen((current) => !current)}
            type="button"
          >
            {t("toc")}
            <ChevronDown className={isTocOpen ? "h-4 w-4 rotate-180" : "h-4 w-4"} aria-hidden />
          </button>
          {isTocOpen ? <div className="mt-3"><Toc items={toc} title={t("toc")} compact /></div> : null}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="mb-8 flex flex-col gap-4 border-b border-sigma-line pb-6">
          <nav className="flex items-center gap-2 text-sm text-sigma-muted print:hidden">
            <Link className="hover:text-sigma-text" href={`/${locale}/reports`}>
              {t("breadcrumbReports")}
            </Link>
            <span>/</span>
            <span>{t("breadcrumbCurrent")}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t(`types.${report.report_type}`)}</Badge>
            <span className="text-sm text-sigma-muted">
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(report.generated_at)
              )}
            </span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-3xl font-semibold leading-tight text-sigma-text sm:text-5xl">
              {report.title}
            </h1>
            <Button className="print:hidden" onClick={() => window.print()} variant="secondary">
              <Printer className="h-4 w-4" aria-hidden />
              {t("print")}
            </Button>
          </div>
        </header>

        <div className="report-markdown text-sigma-text">
          <ReportMarkdown content={report.content} slugify={slugify} />
        </div>
      </div>
    </article>
  );
}

function Toc({ compact = false, items, title }: { compact?: boolean; items: TocItem[]; title: string }) {
  const t = useTranslations("reportDetail");

  if (items.length === 0) {
    return <p className="text-sm text-sigma-muted">{t("tocEmpty")}</p>;
  }

  return (
    <nav aria-label={title} className="flex flex-col gap-2">
      {items.map((item) => (
        <a
          className={
            item.level === 3 && !compact
              ? "pl-4 text-sm text-sigma-muted hover:text-sigma-text"
              : "text-sm font-medium text-sigma-muted hover:text-sigma-text"
          }
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
