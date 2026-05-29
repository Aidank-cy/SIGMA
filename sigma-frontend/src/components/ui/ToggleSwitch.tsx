"use client";

import { motion } from "framer-motion";

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
        "relative inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-full border border-transparent transition duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-primary/15"
      )}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full border transition duration-300 ease-out",
          checked ? "border-primary bg-primary" : "border-border bg-muted"
        )}
      >
        <motion.span
          className={cn(
            "h-5 w-5 rounded-full bg-white shadow-md"
          )}
          animate={{ x: checked ? 20 : 2 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </span>
    </button>
  );
}
