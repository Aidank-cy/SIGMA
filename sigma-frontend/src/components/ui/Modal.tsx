"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ModalProps {
  children: ReactNode;
  className?: string;
  closeLabel: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function Modal({ children, className, closeLabel, isOpen, onClose, title }: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label={closeLabel}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        type="button"
      />
      <section
        aria-modal="true"
        className={cn(
          "relative w-full max-w-lg animate-modal-in rounded-2xl border border-border",
          "bg-card p-6 shadow-sm",
          className
        )}
        role="dialog"
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            aria-label={closeLabel}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
