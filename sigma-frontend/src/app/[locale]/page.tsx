import { Activity, FileText, Newspaper, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

const metrics = [
  { key: "items", icon: Newspaper },
  { key: "reports", icon: FileText },
  { key: "sources", icon: Activity },
  { key: "config", icon: Settings }
] as const;

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-line pb-6">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-signal">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl font-semibold text-ink sm:text-5xl">{t("title")}</h1>
          <p className="max-w-2xl text-base leading-7 text-neutral-600">{t("subtitle")}</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                key={metric.key}
                className="rounded-lg border border-line bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-neutral-500">
                    {t(`metrics.${metric.key}.label`)}
                  </h2>
                  <Icon className="h-5 w-5 text-signal" aria-hidden />
                </div>
                <p className="mt-4 text-3xl font-semibold text-ink">
                  {t(`metrics.${metric.key}.value`)}
                </p>
                <p className="mt-2 text-sm text-neutral-500">
                  {t(`metrics.${metric.key}.caption`)}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
