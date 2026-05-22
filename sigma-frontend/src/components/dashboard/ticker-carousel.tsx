"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Sparkline } from "@/components/ui/Sparkline";
import { useMarketClock } from "@/hooks/useMarketClock";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import { toIntradayChartData } from "@/lib/marketChart";
import { isPreMarketClearWindow, isTradingHoursActive } from "@/lib/marketSessions";
import { cn } from "@/lib/utils";

const warnedTickerFallbacks = new Set<string>();
type MarketState = "trading" | "closed" | "unopened";

interface TickerCarouselProps {
  activeMarket?: string;
  onSelectMarket?: (symbol: string) => void;
}

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

export function TickerCarousel({ activeMarket, onSelectMarket }: TickerCarouselProps) {
  const t = useTranslations("dashboard");
  const { data } = useMarketIndices();
  const now = useMarketClock();
  const { resolvedTheme } = useTheme();
  const flatLineColor = resolvedTheme === "light" ? "oklch(0.15 0 0)" : "oklch(0.3 0 0)";
  const tickers = useMemo(
    () =>
      (data?.indices ?? []).map((index) => {
        const isPreMarket = isPreMarketClearWindow(index.trading_hours, now);
        const isTrading = index.is_trading || isTradingHoursActive(index.trading_hours, now);
        const marketState: MarketState = isPreMarket ? "unopened" : isTrading ? "trading" : "closed";
        const intraday = toIntradayChartData(index, now, false);
        const sparkline = marketState === "unopened"
          ? Array.from({ length: 12 }).map(() => index.value)
          : intraday.length > 1
            ? intraday.map((point) => point.value)
            : fallbackSparkline(index.value, index.change_pct >= 0, index.symbol);
        return {
          change: index.change_pct,
          currency: index.currency,
          marketState,
          name: index.name,
          price: index.value,
          sparkline: sparkline.map((value) => ({ value })),
          symbol: index.symbol
        };
      }),
    [data, now]
  );

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{t("marketMovers")}</h2>

      {tickers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/60">
          {t("empty")}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {tickers.map((ticker, index) => {
            const isPositive = ticker.change >= 0;
            const lineColor = ticker.marketState === "unopened"
              ? flatLineColor
              : isPositive
                ? "oklch(0.65 0.22 145)"
                : "oklch(0.6 0.22 25)";
            const isActive = activeMarket === ticker.symbol;

            return (
              <motion.button
                aria-pressed={isActive}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "grid w-full grid-cols-[minmax(120px,140px)_56px_minmax(70px,1fr)] items-center gap-3 rounded-lg border px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "border-primary/40 bg-primary/10 shadow-sm" : "border-transparent"
                )}
                initial={{ opacity: 0, x: 12 }}
                key={ticker.symbol}
                onClick={() => onSelectMarket?.(ticker.symbol)}
                transition={{ delay: index * 0.04, duration: 0.25 }}
                type="button"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{ticker.name}</p>
                  <p className="truncate text-xs font-medium text-foreground/55">{ticker.symbol}</p>
                </div>

                <div className="flex h-8 w-14 items-center justify-center">
                  <Sparkline color={lineColor} data={ticker.sparkline} height={20} width={48} />
                </div>

                <div className="text-right">
                  <p className="text-base font-bold tabular-nums text-foreground">
                    {ticker.price.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2
                    })}
                  </p>
                  <p className="text-xs font-medium text-foreground/55">
                    {ticker.currency}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
