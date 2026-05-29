export default function MainLoading() {
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-36 animate-pulse rounded-2xl border border-border bg-card" key={index} />
        ))}
      </div>
    </div>
  );
}
