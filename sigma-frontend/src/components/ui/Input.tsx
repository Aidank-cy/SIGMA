"use client";

import type { InputHTMLAttributes } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label: string;
  labelMode?: "floating" | "stacked";
}

export function Input({ className, error, id, label, labelMode = "floating", placeholder, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isStacked = labelMode === "stacked";

  if (isStacked) {
    return (
      <div className="space-y-3">
        <label className="block px-1 text-sm font-medium text-muted-foreground" htmlFor={inputId}>
          {label}
        </label>
        <input
          className={cn(
            "h-12 w-full rounded-2xl border bg-sigma-elevated px-4 text-sm text-sigma-text outline-none",
            "placeholder:text-sigma-muted/70 focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15",
            error ? "border-sigma-danger focus:border-sigma-danger focus:ring-sigma-danger/15" : "",
            className
          )}
          id={inputId}
          placeholder={placeholder}
          {...props}
        />
        {error ? <p className="px-1 text-xs font-medium text-sigma-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="group relative">
        <input
          className={cn(
            "peer h-12 w-full rounded-2xl border bg-sigma-elevated px-4 pb-1.5 pt-[18px] text-sm text-sigma-text outline-none",
            "placeholder:text-transparent focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15",
            error ? "border-sigma-danger focus:border-sigma-danger focus:ring-sigma-danger/15" : "",
            className
          )}
          id={inputId}
          placeholder={placeholder ?? label}
          {...props}
        />
        <label
          className={cn(
            "pointer-events-none absolute left-4 top-[7px] text-xs font-medium text-sigma-muted",
            "peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-[7px] peer-focus:text-xs",
            error ? "text-sigma-danger" : "peer-focus:text-sigma-accent"
          )}
          htmlFor={inputId}
        >
          {label}
        </label>
      </div>
      {error ? <p className="px-1 text-xs font-medium text-sigma-danger">{error}</p> : null}
    </div>
  );
}
