"use client";

import { Activity, FileText, Newspaper, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const metrics = [
  { key: "items", icon: Newspaper },
  { key: "reports", icon: FileText },
  { key: "sources", icon: Activity },
  { key: "config", icon: Settings }
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useTranslations("dashboard");
  const displayName = user?.display_name ?? t("userFallback");

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-sigma-line pb-8">
        <div className="flex flex-wrap gap-2">
          <Badge category="politics">{t("categories.politics")}</Badge>
          <Badge category="finance">{t("categories.finance")}</Badge>
          <Badge category="tech">{t("categories.tech")}</Badge>
          <Badge category="macro">{t("categories.macro")}</Badge>
        </div>
        <div>
          <p className="text-sm font-medium uppercase text-sigma-accent">{t("eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-semibold text-sigma-text sm:text-5xl">
            {t("welcome", { name: displayName })}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-sigma-muted">{t("intro")}</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card className="p-5" interactive key={metric.key}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-sigma-muted">
                  {t(`metrics.${metric.key}.label`)}
                </h2>
                <Icon className="h-5 w-5 text-sigma-accent" aria-hidden />
              </div>
              <p className="mt-4 text-3xl font-semibold text-sigma-text">
                {t(`metrics.${metric.key}.value`)}
              </p>
              <p className="mt-2 text-sm text-sigma-muted">
                {t(`metrics.${metric.key}.caption`)}
              </p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
