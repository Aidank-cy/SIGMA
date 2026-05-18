import { notFound } from "next/navigation";
import { NextIntlClientProvider, useMessages } from "next-intl";

import { AuthProvider } from "@/components/AuthProvider";
import { ClientProviders } from "@/components/ClientProviders";

const locales = ["zh", "en"] as const;

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: {
    locale: string;
  };
}

export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  if (!locales.includes(params.locale as (typeof locales)[number])) {
    notFound();
  }

  const messages = useMessages();

  return (
    <html lang={params.locale}>
      <body>
        <NextIntlClientProvider locale={params.locale} messages={messages}>
          <ClientProviders>
            <AuthProvider>{children}</AuthProvider>
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
