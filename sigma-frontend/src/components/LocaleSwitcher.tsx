"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/cn";

const locales = ["zh", "en"] as const;

interface LocaleSwitcherProps {
  compact?: boolean;
}

export function LocaleSwitcher({ compact = false }: LocaleSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common.locale");

  const switchLocale = (nextLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = nextLocale;
    router.push(segments.join("/") || `/${nextLocale}`);
  };

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-sigma-line bg-sigma-elevated px-3 text-sm text-sigma-muted",
        compact ? "h-9" : "h-10"
      )}
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        className="bg-transparent text-sm font-medium text-sigma-text outline-none"
        onChange={(event) => switchLocale(event.target.value)}
        value={locale}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {t(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
