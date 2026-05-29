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
        "rounded-2xl border border-border bg-card shadow-sm",
        interactive ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" : "",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
