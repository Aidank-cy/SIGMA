"use client";

import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  FileClock,
  LayoutDashboard,
  Menu,
  RadioTower,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "", icon: LayoutDashboard, key: "dashboard" },
  { href: "users", icon: Users, key: "users" },
  { href: "sources", icon: RadioTower, key: "sources" },
  { href: "llm", icon: Bot, key: "llm" },
  { href: "logs", icon: FileClock, key: "logs" }
] as const;

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLoading, user } = useAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("admin.nav");
  const toast = useToast();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading || user?.role === "admin" || hasRedirected.current) {
      return;
    }
    hasRedirected.current = true;
    toast.showToast(t("denied"), "error");
    router.replace(`/${locale}`);
  }, [isLoading, locale, router, t, toast, user]);

  if (isLoading || user?.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sigma-bg text-sigma-muted">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-sigma-line border-t-sigma-accent" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-sigma-bg text-sigma-text">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-sigma-line bg-sigma-bg/90 px-4 backdrop-blur-xl lg:hidden">
        <button
          aria-label={t("open")}
          className="rounded-full p-2 text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-sm font-semibold">{t("title")}</span>
        <Link
          aria-label={t("back")}
          className="rounded-full p-2 text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
          href={`/${locale}`}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 border-r border-sigma-line bg-sigma-surface transition-all duration-200",
          collapsed ? "hidden w-16 lg:block" : "hidden w-60 lg:block"
        )}
      >
        <AdminSidebar
          collapsed={collapsed}
          locale={locale}
          pathname={pathname}
          setCollapsed={setCollapsed}
          userName={user.display_name}
        />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/35 backdrop-blur-sm lg:hidden",
          mobileOpen ? "block" : "hidden"
        )}
      >
        <aside className="h-full w-72 border-r border-sigma-line bg-sigma-surface">
          <AdminSidebar
            collapsed={false}
            locale={locale}
            onNavigate={() => setMobileOpen(false)}
            pathname={pathname}
            setCollapsed={setCollapsed}
            userName={user.display_name}
          />
          <button
            aria-label={t("close")}
            className="absolute right-4 top-4 rounded-full p-2 text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </aside>
      </div>

      <main className={cn("px-4 py-6 sm:px-6 lg:py-8", collapsed ? "lg:ml-16" : "lg:ml-60")}>
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

interface AdminSidebarProps {
  collapsed: boolean;
  locale: string;
  onNavigate?: () => void;
  pathname: string;
  setCollapsed: (value: boolean) => void;
  userName: string;
}

function AdminSidebar({
  collapsed,
  locale,
  onNavigate,
  pathname,
  setCollapsed,
  userName
}: AdminSidebarProps) {
  const t = useTranslations("admin.nav");

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center gap-3 px-4", collapsed ? "justify-center" : "")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sigma-text text-sigma-bg">
          <LayoutDashboard className="h-5 w-5" aria-hidden />
        </span>
        {collapsed ? null : <span className="text-base font-semibold">SIGMA</span>}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const href = `/${locale}/admin${item.href ? `/${item.href}` : ""}`;
          const active = pathname === href;
          return (
            <Link
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                active
                  ? "bg-sigma-text text-sigma-bg"
                  : "text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text",
                collapsed ? "justify-center" : ""
              )}
              href={href}
              key={item.key}
              onClick={onNavigate}
              title={collapsed ? t(item.key) : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {collapsed ? null : t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-sigma-line p-3">
        <Link
          className={cn(
            "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text",
            collapsed ? "justify-center" : ""
          )}
          href={`/${locale}`}
          title={collapsed ? t("back") : undefined}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {collapsed ? null : t("back")}
        </Link>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border border-sigma-line bg-sigma-elevated p-2",
            collapsed ? "justify-center border-0 bg-transparent" : ""
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sigma-accent/15 text-sm font-semibold text-sigma-accent">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sigma-text">{userName}</p>
              <p className="text-xs text-sigma-muted">{t("admin")}</p>
            </div>
          )}
        </div>
        <Button
          aria-label={collapsed ? t("expand") : t("collapse")}
          className="hidden w-full lg:inline-flex"
          onClick={() => setCollapsed(!collapsed)}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", collapsed ? "rotate-180" : "")}
            aria-hidden
          />
          {collapsed ? null : t("collapse")}
        </Button>
      </div>
    </div>
  );
}
