"use client";

import { cn } from "@/lib/cn";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function ToggleSwitch({ checked, label, onChange }: ToggleSwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-transparent transition duration-200 focus:outline-none focus:ring-4 focus:ring-sigma-accent/15"
      )}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition duration-200",
          checked ? "bg-sigma-accent" : "bg-sigma-neutral/35"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow-sm transition duration-200",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
