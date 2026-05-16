import { getRequestConfig } from "next-intl/server";

const locales = ["zh", "en"] as const;

export default getRequestConfig(async ({ locale }) => {
  const activeLocale = locales.includes(locale as (typeof locales)[number]) ? locale : "zh";

  return {
    locale: activeLocale,
    messages: (await import(`../../messages/${activeLocale}.json`)).default
  };
});
