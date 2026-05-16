import { cn } from "@/lib/cn";

const categoryClasses = {
  politics: "bg-category-politics/10 text-category-politics ring-category-politics/20",
  finance: "bg-category-finance/10 text-category-finance ring-category-finance/20",
  tech: "bg-category-tech/10 text-category-tech ring-category-tech/20",
  macro: "bg-category-macro/10 text-category-macro ring-category-macro/20"
} as const;

const marketFlags = {
  us: "🇺🇸",
  cn: "🇨🇳",
  jp: "🇯🇵",
  eu: "🇪🇺",
  hk: "🇭🇰"
} as const;

interface BadgeProps {
  category?: keyof typeof categoryClasses;
  children: string;
  className?: string;
  market?: keyof typeof marketFlags;
}

export function Badge({ category, children, className, market }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1",
        category ? categoryClasses[category] : "bg-sigma-elevated text-sigma-muted ring-sigma-line",
        className
      )}
    >
      {market ? <span aria-hidden>{marketFlags[market]}</span> : null}
      {children}
    </span>
  );
}
