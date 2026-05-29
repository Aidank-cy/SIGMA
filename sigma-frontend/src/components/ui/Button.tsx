"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
  secondary:
    "border border-border bg-secondary text-foreground shadow-sm hover:brightness-110",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground hover:brightness-110",
  danger: "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110"
} as const;

const sizes = {
  sm: "h-10 min-w-10 gap-2 px-3 text-sm",
  md: "h-10 min-w-10 gap-2.5 px-4 text-sm",
  lg: "h-10 min-w-10 gap-3 px-5 text-base"
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  isLoading?: boolean;
  size?: keyof typeof sizes;
  variant?: keyof typeof variants;
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl font-bold outline-none transition-all duration-200",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
        sizes[size],
        variants[variant],
        className
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
