"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

// Deprecated: use CustomSelect for design-system dropdowns. Keep this native select fallback for edge cases.
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label: string;
  leadingIcon?: ReactNode;
  selectClassName?: string;
  showLabel?: boolean;
  wrapperClassName?: string;
}

export function Select({
  children,
  className,
  error,
  id,
  label,
  leadingIcon,
  selectClassName,
  showLabel = true,
  wrapperClassName,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hasLeadingIcon = leadingIcon !== undefined;

  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      <div className={cn("group relative", className)}>
        {hasLeadingIcon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sigma-muted">
            {leadingIcon}
          </span>
        ) : null}
        <select
          className={cn(
            "peer h-12 w-full appearance-none rounded-2xl border border-sigma-line bg-sigma-elevated text-sm font-medium text-sigma-text outline-none",
            "focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15",
            showLabel ? "pb-1.5 pt-[18px]" : "py-0",
            hasLeadingIcon ? "pl-11" : "pl-4",
            "pr-10",
            error ? "border-sigma-danger focus:border-sigma-danger focus:ring-sigma-danger/15" : "",
            selectClassName
          )}
          id={selectId}
          {...props}
        >
          {children}
        </select>
        <label
          className={cn(
            "pointer-events-none absolute left-4 top-[7px] text-xs font-medium text-sigma-muted transition-colors",
            hasLeadingIcon ? "left-11" : "",
            showLabel ? "" : "sr-only",
            error ? "text-sigma-danger" : "peer-focus:text-sigma-accent"
          )}
          htmlFor={selectId}
        >
          {label}
        </label>
        <ChevronDown
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sigma-muted transition-transform duration-150 group-focus-within:rotate-180"
          aria-hidden
        />
      </div>
      {error ? <p className="px-1 text-xs font-medium text-sigma-danger">{error}</p> : null}
    </div>
  );
}
