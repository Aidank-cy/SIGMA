"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { Select } from "@/components/ui/Select";

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
    <Select
      aria-label={t("label")}
      label={t("label")}
      leadingIcon={<Languages className="h-4 w-4" aria-hidden />}
      onChange={(event) => switchLocale(event.target.value)}
      selectClassName={compact ? "h-10 min-w-28" : "h-12 min-w-32"}
      showLabel={false}
      value={locale}
      wrapperClassName="shrink-0"
    >
        {locales.map((item) => (
          <option key={item} value={item}>
            {t(item)}
          </option>
        ))}
    </Select>
  );
}
