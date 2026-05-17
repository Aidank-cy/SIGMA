import { notFound } from "next/navigation";
import { Inter, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider, useMessages } from "next-intl";

import { AuthProvider } from "@/components/AuthProvider";
import { ClientProviders } from "@/components/ClientProviders";

const locales = ["zh", "en"] as const;

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter"
});

const notoSansSc = Noto_Sans_SC({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-noto-sans-sc"
});

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
    <html className={`${inter.variable} ${notoSansSc.variable}`} lang={params.locale}>
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
