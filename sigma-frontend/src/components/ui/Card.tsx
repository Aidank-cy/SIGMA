import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export function Card({ children, className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-sigma-line bg-sigma-surface shadow-apple-soft",
        interactive ? "hover:-translate-y-0.5 hover:shadow-apple" : "",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
