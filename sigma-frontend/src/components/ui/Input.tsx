"use client";

import type { InputHTMLAttributes } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label: string;
}

export function Input({ className, error, id, label, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="space-y-2">
      <div className="group relative">
        <input
          className={cn(
            "peer h-14 w-full rounded-2xl border bg-sigma-elevated px-4 pb-2 pt-6 text-sm text-sigma-text outline-none",
            "placeholder:text-transparent focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15",
            error ? "border-sigma-danger focus:border-sigma-danger focus:ring-sigma-danger/15" : "",
            className
          )}
          id={inputId}
          placeholder={label}
          {...props}
        />
        <label
          className={cn(
            "pointer-events-none absolute left-4 top-2 text-xs font-medium text-sigma-muted",
            "peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs",
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
