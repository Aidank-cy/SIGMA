"use client";

export function ChartSkeleton() {
  return <div className="h-[408px] animate-pulse rounded-2xl border border-border bg-card lg:h-[488px]" />;
}

export function TickerSkeleton() {
  return (
    <div className="h-full rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="mb-3 h-14 animate-pulse rounded-xl bg-muted/60" key={index} />
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="h-[154px] animate-pulse rounded-2xl border border-border bg-card" key={index} />
      ))}
    </div>
  );
}
