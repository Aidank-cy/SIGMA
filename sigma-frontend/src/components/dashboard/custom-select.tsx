"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  labelMode?: "floating" | "stacked";
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
  labelMode = "floating",
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
  const [isMounted, setIsMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const hasLeadingIcon = leadingIcon !== undefined;
  const isStacked = labelMode === "stacked";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return;
    }

    function updateDropdownPosition() {
      if (!buttonRef.current) {
        return;
      }
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        left: rect.left,
        position: "fixed",
        top: rect.bottom + 4,
        width: rect.width,
        zIndex: 50
      });
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideRoot && !insideDropdown) {
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
    <div className={cn(isStacked ? "space-y-1" : "space-y-2", wrapperClassName)} ref={rootRef}>
      {isStacked ? (
        <label className="block px-1 text-sm font-bold text-muted-foreground" htmlFor={generatedId}>
          {label}
        </label>
      ) : null}
      <div className={cn("group relative", className)}>
        {hasLeadingIcon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
            {leadingIcon}
          </span>
        ) : null}
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel ?? label}
          className={cn(
            "peer flex h-12 w-full appearance-none items-center rounded-2xl border border-border bg-card text-left text-sm font-bold text-foreground outline-none",
            "focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60",
            showLabel && !isStacked ? "pb-1.5 pt-[18px]" : "py-0",
            hasLeadingIcon ? "pl-11" : "pl-4",
            "pr-10",
            error ? "border-destructive focus:border-destructive focus:ring-destructive/15" : "",
            selectClassName
          )}
          disabled={disabled}
          id={generatedId}
          onClick={() => setIsOpen((current) => !current)}
          ref={buttonRef}
          type="button"
        >
          <span className="block min-w-0 truncate">{selected?.label ?? ""}</span>
        </button>
        {!isStacked ? (
          <label
            className={cn(
              "pointer-events-none absolute left-4 top-[7px] text-xs text-muted-foreground transition-colors",
              hasLeadingIcon ? "left-11" : "",
              showLabel ? "" : "sr-only",
              error ? "text-destructive" : "peer-focus:text-primary"
            )}
            htmlFor={generatedId}
          >
            {label}
          </label>
        ) : null}
        <ChevronDown
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform duration-150",
            isOpen ? "rotate-180" : ""
          )}
        />
        {isMounted
          ? createPortal(
              <AnimatePresence>
                {isOpen ? (
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="rounded-2xl border border-border bg-popover p-2 shadow-sm"
                    exit={{ opacity: 0, scale: 0.98, y: -6 }}
                    initial={{ opacity: 0, scale: 0.98, y: -6 }}
                    ref={dropdownRef}
                    style={dropdownStyle}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div aria-label={label} className="space-y-1" role="listbox">
                      {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                          <button
                            aria-selected={isSelected}
                            className={cn(
                              "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-bold",
                              isSelected
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-card hover:text-foreground"
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
                  </motion.div>
                ) : null}
              </AnimatePresence>,
              document.body
            )
          : null}
      </div>
      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
