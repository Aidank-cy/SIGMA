"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  LayoutDashboard,
  LineChart,
  LogOut,
  Moon,
  Newspaper,
  RefreshCw,
  Settings,
  Sun
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const { logout, user } = useAuth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setAccountMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  const navItems = [
    { icon: LayoutDashboard, label: t("dashboard"), id: "dashboard", href: `/${locale}` },
    { icon: LineChart, label: t("markets"), id: "markets", href: `/${locale}/markets` },
    { icon: Newspaper, label: t("news"), id: "news", href: `/${locale}/news` },
    { icon: BarChart3, label: t("analytics"), id: "analytics", href: `/${locale}/analytics` },
    { icon: RefreshCw, label: t("sync"), id: "sync", href: `/${locale}/sync` },
    { icon: Settings, label: t("settings"), id: "settings", href: `/${locale}/settings` }
  ];

  const getActiveId = () => {
    const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, "") || "/";
    if (pathWithoutLocale === "/") return "dashboard";
    const match = navItems.find((item) => pathWithoutLocale.startsWith(`/${item.id}`));
    return match?.id || "dashboard";
  };

  const activeId = getActiveId();
  const avatarLabel = user?.display_name?.charAt(0)?.toUpperCase() || "S";
  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const settingsHref = `/${locale}/settings`;

  return (
    <>
    <motion.aside
      animate={{ opacity: 1, x: 0 }}
      className="fixed left-0 top-0 z-50 hidden h-screen w-20 flex-col items-center border-r border-sidebar-border py-6 md:flex frosted-glass"
      initial={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Link aria-label="SIGMA" className="mb-8" href={`/${locale}`} prefetch>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-transparent">
            <span className="text-lg font-bold text-foreground">S</span>
          </div>
        </motion.div>
      </Link>

      <span className="mb-4 text-xs font-bold uppercase tracking-widest text-sidebar-foreground/50">
        {t("menu")}
      </span>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = activeId === item.id;
          const isHovered = hoveredId === item.id;
          const Icon = item.icon;

          return (
            <div className="relative" key={item.id}>
              <Link
                aria-label={item.label}
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/30"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                href={item.href}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                prefetch
              >
                <motion.span
                  className="flex h-full w-full items-center justify-center"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="h-5 w-5" />
                </motion.span>

                {isActive ? (
                  <motion.div
                    className="absolute -left-6 h-6 w-1 rounded-r-full bg-sidebar-primary"
                    transition={{ damping: 35, mass: 0.8, stiffness: 500, type: "spring" }}
                  />
                ) : null}
              </Link>

              <AnimatePresence>
                {isHovered && !isActive ? (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-xl"
                    exit={{ opacity: 0, x: -10 }}
                    initial={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.label}
                    <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-border bg-popover" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="relative mt-auto flex flex-col items-center gap-3" ref={accountMenuRef}>
        <motion.button
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          aria-label={t("accountMenu")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-accent text-sm font-semibold text-white ring-2 ring-sidebar-border transition-all duration-200 hover:ring-sidebar-primary/50"
          onClick={() => setAccountMenuOpen((open) => !open)}
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {avatarLabel}
        </motion.button>

        <AnimatePresence>
          {accountMenuOpen ? (
            <motion.div
              animate={{ opacity: 1, x: 0, y: 0 }}
              className="absolute bottom-0 left-full z-50 ml-3 w-44 rounded-xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-xl backdrop-blur-xl"
              exit={{ opacity: 0, x: -8, y: 6 }}
              initial={{ opacity: 0, x: -8, y: 6 }}
              role="menu"
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <Link
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-popover-foreground transition-colors hover:bg-muted"
                href={settingsHref}
                onClick={() => setAccountMenuOpen(false)}
                prefetch
                role="menuitem"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>{t("settings")}</span>
              </Link>
              <button
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-popover-foreground transition-colors hover:bg-muted"
                onClick={() => setTheme(nextTheme)}
                role="menuitem"
                type="button"
              >
                {isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                <span>{isDark ? t("themeDarkMode") : t("themeLightMode")}</span>
              </button>
              <button
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-popover-foreground transition-colors hover:bg-muted"
                onClick={logout}
                role="menuitem"
                type="button"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span>{t("logout")}</span>
              </button>
              <div className="absolute -left-1 bottom-4 h-2 w-2 rotate-45 border-b border-l border-border bg-popover/95" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.aside>
    <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-6 gap-1 rounded-2xl border border-border bg-card/95 p-1 shadow-apple backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const isActive = activeId === item.id;
        const Icon = item.icon;

        return (
          <Link
            aria-label={item.label}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-all",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            href={item.href}
            key={item.id}
            prefetch
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
    </>
  );
}
