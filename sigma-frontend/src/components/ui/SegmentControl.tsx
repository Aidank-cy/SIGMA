"use client";

import { LayoutGroup, motion } from "framer-motion";
import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SegmentItem {
  id: string;
  label: ReactNode;
}

interface SegmentControlProps {
  activeId: string;
  className?: string;
  items: SegmentItem[];
  onChange: (id: string) => void;
}

export function SegmentControl({ activeId, className, items, onChange }: SegmentControlProps) {
  const groupId = useId();

  return (
    <LayoutGroup id={groupId}>
      <div className={cn("inline-flex w-fit rounded-full border border-sigma-line bg-sigma-elevated p-1", className)}>
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              className={cn(
                "relative h-11 min-w-20 rounded-full px-4 text-sm font-medium transition-colors",
                active ? "text-sigma-bg" : "text-sigma-muted hover:text-sigma-text"
              )}
              key={item.id}
              onClick={() => onChange(item.id)}
              type="button"
            >
              {active ? (
                <motion.div
                  className="absolute inset-0 rounded-full bg-sigma-text shadow-apple-soft"
                  layoutId="tab-indicator"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                />
              ) : null}
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
