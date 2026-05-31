"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { SelectPortal, SelectTrigger, useDropdownDismiss, useDropdownPosition } from "./custom-select-parts";

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

  useDropdownPosition(buttonRef, isOpen, setDropdownStyle);
  useDropdownDismiss(dropdownRef, isOpen, rootRef, setIsOpen);

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
      <SelectTrigger
        ariaLabel={ariaLabel}
        buttonRef={buttonRef}
        className={className}
        disabled={disabled}
        error={error}
        generatedId={generatedId}
        hasLeadingIcon={hasLeadingIcon}
        isOpen={isOpen}
        isStacked={isStacked}
        label={label}
        leadingIcon={leadingIcon}
        selectClassName={selectClassName}
        selected={selected}
        setIsOpen={setIsOpen}
        showLabel={showLabel}
      />
      <SelectPortal
        dropdownRef={dropdownRef}
        dropdownStyle={dropdownStyle}
        isMounted={isMounted}
        isOpen={isOpen}
        label={label}
        onSelect={selectOption}
        options={options}
        value={value}
      />
      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
