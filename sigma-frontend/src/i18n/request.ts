import { getRequestConfig } from "next-intl/server";

const locales = ["zh", "en"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const activeLocale = locales.includes(requestedLocale as (typeof locales)[number])
    ? requestedLocale
    : "zh";

  return {
    locale: activeLocale,
    messages: (await import(`../../messages/${activeLocale}.json`)).default
  };
});
