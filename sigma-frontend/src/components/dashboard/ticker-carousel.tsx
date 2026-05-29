"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Sparkline } from "@/components/ui/Sparkline";
import { useMarketClock } from "@/hooks/useMarketClock";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import { toIntradayChartData } from "@/lib/marketChart";
import { isPreMarketClearWindow, isTradingHoursActive } from "@/lib/marketSessions";
import { cn } from "@/lib/utils";

type MarketState = "trading" | "closed" | "unopened";

interface TickerCarouselProps {
  activeMarket?: string;
  onSelectMarket?: (symbol: string) => void;
}

export function TickerCarousel({ activeMarket, onSelectMarket }: TickerCarouselProps) {
  const t = useTranslations("dashboard");
  const { data } = useMarketIndices();
  const now = useMarketClock();
  const flatLineColor = "var(--muted-foreground)";
  const tickers = useMemo(
    () =>
      (data?.indices ?? []).map((index) => {
        const isPreMarket = isPreMarketClearWindow(index.trading_hours, now);
        const isTrading = index.is_trading || isTradingHoursActive(index.trading_hours, now);
        const marketState: MarketState = isPreMarket ? "unopened" : isTrading ? "trading" : "closed";
        const intraday = toIntradayChartData(index, now, false);
        const sparkline = intraday.length > 1
          ? intraday.map((point) => point.value)
          : Array.from({ length: 12 }).map(() => index.value);
        const hasMovementData = new Set(sparkline.map((value) => value.toFixed(4))).size > 1;
        return {
          change: index.change_pct,
          currency: index.currency,
          hasMovementData,
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
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-bold text-foreground">{t("marketMovers")}</h2>

      {tickers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/60">
          {t("empty")}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {tickers.map((ticker, index) => {
            const isPositive = ticker.change >= 0;
            const lineColor = !ticker.hasMovementData
              ? flatLineColor
              : isPositive
                ? "var(--chart-1)"
                : "var(--chart-2)";
            const isActive = activeMarket === ticker.symbol;

            return (
              <motion.button
                aria-pressed={isActive}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "grid w-full grid-cols-[minmax(120px,140px)_56px_minmax(70px,1fr)] items-center gap-3 rounded-2xl border px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                  <p className="truncate text-xs text-foreground/55">{ticker.symbol}</p>
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
                  <p className="text-xs text-foreground/55">
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
