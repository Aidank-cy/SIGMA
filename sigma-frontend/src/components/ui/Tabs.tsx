"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface TabItem {
  id: string;
  label: ReactNode;
}

interface TabsProps {
  activeId: string;
  items: TabItem[];
  onChange: (id: string) => void;
}

export function Tabs({ activeId, items, onChange }: TabsProps) {
  return (
    <div className="inline-flex rounded-full border border-sigma-line bg-sigma-elevated p-1">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            className={cn(
              "relative h-9 min-w-20 rounded-full px-4 text-sm font-medium",
              active ? "text-sigma-bg" : "text-sigma-muted hover:text-sigma-text"
            )}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {active ? (
              <span className="absolute inset-0 rounded-full bg-sigma-text shadow-apple-soft" />
            ) : null}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
