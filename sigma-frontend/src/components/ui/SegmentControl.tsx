"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-seg-id="${activeId}"]`
    ) as HTMLElement | null;
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeId]);

  useEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex w-fit rounded-full border border-border bg-muted p-1",
        className
      )}
    >
      {indicator.width > 0 && (
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-primary shadow-sm"
          animate={{ left: indicator.left, width: indicator.width }}
          transition={{ damping: 30, stiffness: 400, type: "spring" }}
        />
      )}
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            className={cn(
              "relative z-10 h-11 min-w-20 rounded-full px-4 text-sm font-medium transition-colors duration-200",
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-seg-id={item.id}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
