"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Sparkline } from "@/components/ui/Sparkline";
import { useMarketClock } from "@/hooks/useMarketClock";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import { isPreMarketClearWindow } from "@/lib/marketSessions";
import { cn } from "@/lib/utils";

const warnedTickerFallbacks = new Set<string>();
const currencySymbols: Record<string, string> = {
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  HKD: "HK$",
  JPY: "¥",
  KRW: "₩",
  TWD: "NT$",
  USD: "$"
};

function fallbackSparkline(value: number, positive: boolean, symbol: string) {
  if (!warnedTickerFallbacks.has(symbol)) {
    warnedTickerFallbacks.add(symbol);
    console.warn(
      `SIGMA is displaying a generated ticker sparkline for ${symbol} because the API response did not include enough live sparkline points.`
    );
  }
  return Array.from({ length: 12 }).map((_, index) => {
    const drift = positive ? index * value * 0.001 : -index * value * 0.001;
    const wave = Math.sin(index) * value * 0.002;
    return value + drift + wave;
  });
}

export function TickerCarousel() {
  const t = useTranslations("dashboard");
  const { data } = useMarketIndices();
  const now = useMarketClock();
  const tickers = (data?.indices ?? []).map((index) => {
    const isPreMarket = isPreMarketClearWindow(index.trading_hours, now);
    const sparkline = isPreMarket
      ? Array.from({ length: 12 }).map(() => index.value)
      : index.sparkline_24h.length > 1
        ? index.sparkline_24h
        : fallbackSparkline(index.value, index.change_pct >= 0, index.symbol);
    return {
      change: index.change_pct,
      currency: index.currency,
      isPreMarket,
      name: index.name,
      price: index.value,
      sparkline: sparkline.map((value) => ({ value })),
      symbol: index.symbol
    };
  });

  return (
    <section className="h-full max-h-[488px] rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{t("marketMovers")}</h2>

      {tickers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/60">
          {t("empty")}
        </div>
      ) : (
        <div className="max-h-[424px] space-y-1 overflow-y-auto pr-1">
          {tickers.map((ticker, index) => {
            const isPositive = ticker.change >= 0;
            const lineColor = ticker.isPreMarket
              ? "oklch(0.45 0.01 270)"
              : isPositive
                ? "oklch(0.65 0.22 145)"
                : "oklch(0.6 0.22 25)";

            return (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-[minmax(0,1fr)_56px_minmax(70px,auto)] items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                initial={{ opacity: 0, x: 12 }}
                key={ticker.symbol}
                transition={{ delay: index * 0.04, duration: 0.25 }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{ticker.name}</p>
                  <p className="truncate text-xs font-medium text-foreground/55">{ticker.symbol}</p>
                </div>

                <div className="flex justify-center">
                  <Sparkline color={lineColor} data={ticker.sparkline} height={20} width={48} />
                </div>

                <p className="text-right text-sm font-bold tabular-nums text-foreground">
                  <span className="mr-1 text-xs font-semibold text-foreground/55">
                    {currencySymbols[ticker.currency] ?? ticker.currency}
                  </span>
                  <span className={cn(ticker.price >= 100000 && "text-xs")}>
                    {ticker.price.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2
                    })}
                  </span>
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
