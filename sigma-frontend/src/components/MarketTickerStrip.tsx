"use client";

import { Sparkline } from "@/components/ui/Sparkline";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import { cn } from "@/lib/cn";

export function MarketTickerStrip() {
  const { data, isLoading } = useMarketIndices();

  return (
    <div className="h-9 border-b border-sigma-line bg-sigma-bg/88 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl snap-x snap-mandatory items-center gap-3 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <Skeleton className="h-5 min-w-40 rounded-full" key={index} />
            ))
          : data?.indices.map((index) => {
              const positive = index.change_pct >= 0;
              return (
                <div
                  className="flex min-w-max snap-start items-center gap-2 rounded-full px-2 text-xs"
                  key={index.symbol}
                >
                  <span className="font-semibold text-sigma-text">{index.name}</span>
                  <span className="tabular-nums text-sigma-muted">{index.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      positive ? "text-sigma-success" : "text-sigma-danger"
                    )}
                  >
                    {positive ? "+" : ""}
                    {index.change_pct.toFixed(2)}%
                  </span>
                  <Sparkline
                    data={index.sparkline_24h.map((value) => ({ value }))}
                    height={18}
                    positive={positive}
                    width={64}
                  />
                </div>
              );
            })}
      </div>
    </div>
  );
}
