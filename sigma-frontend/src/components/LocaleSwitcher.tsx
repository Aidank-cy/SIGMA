"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { CustomSelect } from "@/components/ui/CustomSelect";

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
    <CustomSelect
      aria-label={t("label")}
      label={t("label")}
      leadingIcon={<Languages className="h-4 w-4" aria-hidden />}
      onChange={switchLocale}
      options={locales.map((item) => ({ label: t(item), value: item }))}
      selectClassName={compact ? "h-11 min-w-28" : "h-12 min-w-32"}
      showLabel={false}
      value={locale}
      wrapperClassName="shrink-0"
    />
  );
}
