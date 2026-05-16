"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-sigma-text text-sigma-bg shadow-apple-soft hover:-translate-y-0.5",
  secondary:
    "border border-sigma-line bg-sigma-elevated text-sigma-text hover:-translate-y-0.5 hover:bg-sigma-elevated/80",
  ghost: "text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text",
  danger: "bg-sigma-danger text-white shadow-apple-soft hover:-translate-y-0.5"
} as const;

const sizes = {
  sm: "h-9 gap-2 px-3 text-sm",
  md: "h-11 gap-2.5 px-4 text-sm",
  lg: "h-12 gap-3 px-5 text-base"
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
        "inline-flex items-center justify-center rounded-full font-medium outline-none",
        "focus-visible:ring-2 focus-visible:ring-sigma-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sigma-bg",
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
