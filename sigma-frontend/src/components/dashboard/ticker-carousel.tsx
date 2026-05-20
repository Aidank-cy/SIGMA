"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useMarketIndices } from "@/hooks/useMarketIndices";
import { cn } from "@/lib/utils";

function fallbackSparkline(value: number, positive: boolean) {
  return Array.from({ length: 12 }).map((_, index) => {
    const drift = positive ? index * value * 0.001 : -index * value * 0.001;
    const wave = Math.sin(index) * value * 0.002;
    return value + drift + wave;
  });
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 64;
      const y = 22 - ((value - min) / range) * 18;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="overflow-visible" height="26" width="64">
      <polyline
        fill="none"
        points={points}
        stroke={positive ? "oklch(0.65 0.22 145)" : "oklch(0.6 0.22 25)"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function TickerCarousel() {
  const { data } = useMarketIndices();
  const tickers = (data?.indices ?? []).map((index) => ({
    change: index.change_pct,
    name: index.name,
    price: index.value,
    sparkline: index.sparkline_24h.length > 1
      ? index.sparkline_24h
      : fallbackSparkline(index.value, index.change_pct >= 0),
    symbol: index.symbol
  }));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { clientWidth, scrollLeft, scrollWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", checkScroll);
      checkScroll();
      return () => element.removeEventListener("scroll", checkScroll);
    }
  }, [tickers.length]);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -320 : 320
    });
  };

  if (tickers.length === 0) {
    return null;
  }

  return (
    <div className="group relative">
      <button
        aria-label="Scroll left"
        className={cn(
          "absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/95 p-2.5 text-foreground shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-muted",
          canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => scroll("left")}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        aria-label="Scroll right"
        className={cn(
          "absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/95 p-2.5 text-foreground shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-muted",
          canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => scroll("right")}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 top-0 z-[5] w-16 bg-gradient-to-r from-background to-transparent transition-opacity",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 top-0 z-[5] w-16 bg-gradient-to-l from-background to-transparent transition-opacity",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />

      <div className="hide-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-8 py-2" ref={scrollRef}>
        {tickers.map((ticker, index) => {
          const isPositive = ticker.change >= 0;
          return (
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="group/card min-w-[190px] flex-shrink-0 cursor-pointer rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              key={ticker.symbol}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-base font-bold text-foreground transition-colors group-hover/card:text-primary">
                    {ticker.symbol}
                  </p>
                  <p className="max-w-[85px] truncate text-xs text-muted-foreground">{ticker.name}</p>
                </div>
                <Sparkline data={ticker.sparkline} positive={isPositive} />
              </div>
              <div className="flex items-end justify-between">
                <p className="text-lg font-bold text-foreground">
                  {ticker.price.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                </p>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                    isPositive ? "bg-chart-1/10 text-chart-1" : "bg-chart-2/10 text-chart-2"
                  )}
                >
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>
                    {isPositive ? "+" : ""}
                    {ticker.change.toFixed(2)}%
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
