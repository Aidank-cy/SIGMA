"use client";

import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export interface CustomSelectOption {
  label: string;
  value: string;
}

interface CustomSelectProps {
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  label: string;
  leadingIcon?: ReactNode;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  selectClassName?: string;
  showLabel?: boolean;
  value: string;
  wrapperClassName?: string;
}

export function CustomSelect({
  "aria-label": ariaLabel,
  className,
  disabled = false,
  error,
  label,
  leadingIcon,
  onChange,
  options,
  selectClassName,
  showLabel = true,
  value,
  wrapperClassName
}: CustomSelectProps) {
  const generatedId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const hasLeadingIcon = leadingIcon !== undefined;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectOption(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className={cn("space-y-2", wrapperClassName)} ref={rootRef}>
      <div className={cn("group relative", className)}>
        {hasLeadingIcon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sigma-muted">
            {leadingIcon}
          </span>
        ) : null}
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel ?? label}
          className={cn(
            "peer flex h-12 w-full appearance-none items-center rounded-2xl border border-sigma-line bg-sigma-elevated text-left text-sm font-medium text-sigma-text outline-none",
            "focus:border-sigma-accent focus:ring-4 focus:ring-sigma-accent/15 disabled:cursor-not-allowed disabled:opacity-60",
            showLabel ? "pb-1.5 pt-[18px]" : "py-0",
            hasLeadingIcon ? "pl-11" : "pl-4",
            "pr-10",
            error ? "border-sigma-danger focus:border-sigma-danger focus:ring-sigma-danger/15" : "",
            selectClassName
          )}
          disabled={disabled}
          id={generatedId}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="block min-w-0 truncate">{selected?.label ?? ""}</span>
        </button>
        <label
          className={cn(
            "pointer-events-none absolute left-4 top-[7px] text-xs font-medium text-sigma-muted transition-colors",
            hasLeadingIcon ? "left-11" : "",
            showLabel ? "" : "sr-only",
            error ? "text-sigma-danger" : "peer-focus:text-sigma-accent"
          )}
          htmlFor={generatedId}
        >
          {label}
        </label>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sigma-muted transition-transform duration-150",
            isOpen ? "rotate-180" : ""
          )}
          aria-hidden
        />
        {isOpen ? (
          <div className="absolute left-0 top-14 z-30 w-full rounded-2xl border border-sigma-line bg-sigma-surface p-2 shadow-apple">
            <div className="space-y-1" role="listbox" aria-label={label}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    aria-selected={isSelected}
                    className={cn(
                      "flex h-9 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold",
                      isSelected
                        ? "bg-sigma-text text-sigma-bg"
                        : "text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                    )}
                    key={option.value}
                    onClick={() => selectOption(option.value)}
                    role="option"
                    type="button"
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p className="px-1 text-xs font-medium text-sigma-danger">{error}</p> : null}
    </div>
  );
}
