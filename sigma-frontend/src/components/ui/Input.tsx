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
      <div className="space-y-1">
        <label className="block px-1 text-sm text-muted-foreground" htmlFor={inputId}>
          {label}
        </label>
        <input
          className={cn(
            "h-10 w-full rounded-2xl border bg-secondary px-4 text-sm text-foreground outline-none transition-all duration-200",
            "placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20",
            error ? "border-destructive focus:border-destructive focus:ring-destructive/20" : "",
            className
          )}
          id={inputId}
          placeholder={placeholder}
          {...props}
        />
        {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="group relative">
        <input
          className={cn(
            "peer h-10 w-full rounded-2xl border bg-secondary px-4 pb-1.5 pt-[15px] text-sm text-foreground outline-none transition-all duration-200",
            "placeholder:text-transparent focus:border-primary focus:ring-2 focus:ring-primary/20",
            error ? "border-destructive focus:border-destructive focus:ring-destructive/20" : "",
            className
          )}
          id={inputId}
          placeholder={placeholder ?? label}
          {...props}
        />
        <label
          className={cn(
            "pointer-events-none absolute left-4 top-[5px] text-xs text-muted-foreground",
            "peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-sm peer-focus:top-[5px] peer-focus:text-xs",
            error ? "text-destructive" : "peer-focus:text-primary"
          )}
          htmlFor={inputId}
        >
          {label}
        </label>
      </div>
      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
