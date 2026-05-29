import { cn } from "@/lib/cn";

const categoryClasses = {
  politics: "bg-category-politics/10 text-category-politics ring-category-politics/20",
  finance: "bg-category-finance/10 text-category-finance ring-category-finance/20",
  technology: "bg-category-tech/10 text-category-tech ring-category-tech/20",
  tech: "bg-category-tech/10 text-category-tech ring-category-tech/20",
  macro: "bg-category-macro/10 text-category-macro ring-category-macro/20",
  other: "bg-secondary text-muted-foreground ring-border"
} as const;

const marketFlags = {
  us: "🇺🇸",
  cn: "🇨🇳",
  jp: "🇯🇵",
  eu: "🇪🇺",
  hk: "🇭🇰",
  kr: "🇰🇷",
  tw: "🇹🇼",
  global: "🌐"
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
        "inline-flex h-7 items-center gap-1.5 rounded-2xl px-3 text-xs font-bold ring-1",
        category ? categoryClasses[category] : "bg-secondary text-muted-foreground ring-border",
        className
      )}
    >
      {market ? <span aria-hidden>{marketFlags[market]}</span> : null}
      {children}
    </span>
  );
}
