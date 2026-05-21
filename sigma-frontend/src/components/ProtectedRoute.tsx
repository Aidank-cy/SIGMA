"use client";

import { Loader2 } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/components/AuthProvider";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, user } = useAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const isLocaleMismatch = Boolean(user?.locale && user.locale !== locale);

  useEffect(() => {
    if (!isLoading && user === null) {
      router.replace(`/${locale}/login`);
      return;
    }
    if (!isLoading && user !== null && user.locale !== locale) {
      router.replace(pathname.replace(/^\/(zh|en)/, `/${user.locale}`));
    }
  }, [isLoading, locale, pathname, router, user]);

  if (isLoading || user === null || isLocaleMismatch) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sigma-bg text-sigma-muted">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </main>
    );
  }

  return children;
}
