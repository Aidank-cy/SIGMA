"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info
} as const;

const tones = {
  success: "text-sigma-success",
  error: "text-sigma-danger",
  info: "text-sigma-accent"
} as const;

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const t = useTranslations("common");

  const closeToast = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now();
      setItems((current) => [...current, { id, message, type }]);
      window.setTimeout(() => closeToast(id), 4200);
    },
    [closeToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {items.map((item) => {
          const Icon = icons[item.type];
          return (
            <div
              className="animate-toast-in rounded-2xl border border-sigma-line bg-sigma-elevated/95 p-4 shadow-apple backdrop-blur-xl"
              key={item.id}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tones[item.type])} aria-hidden />
                <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-sigma-text">
                  {item.message}
                </p>
                <button
                  aria-label={t("close")}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sigma-muted hover:bg-sigma-surface hover:text-sigma-text"
                  onClick={() => closeToast(item.id)}
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
