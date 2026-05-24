"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ModalProps {
  children: ReactNode;
  closeLabel: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function Modal({ children, closeLabel, isOpen, onClose, title }: ModalProps) {
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
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        type="button"
      />
      <section
        aria-modal="true"
        className={cn(
          "relative w-full max-w-lg animate-modal-in rounded-lg border border-sigma-line",
          "bg-sigma-elevated p-6 shadow-apple"
        )}
        role="dialog"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-sigma-text">{title}</h2>
          <button
            aria-label={closeLabel}
            className="flex h-11 w-11 items-center justify-center rounded-full text-sigma-muted hover:bg-sigma-surface hover:text-sigma-text"
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
