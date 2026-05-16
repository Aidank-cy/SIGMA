"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const theme = window.localStorage.getItem("sigma.theme");
    if (theme === "dark" || theme === "light") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
