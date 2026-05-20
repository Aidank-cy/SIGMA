"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  LayoutDashboard,
  LineChart,
  Moon,
  Newspaper,
  RefreshCw,
  Settings,
  Sun
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const { logout, user } = useAuth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const nextTheme = mounted && theme === "dark" ? "light" : "dark";

  return (
    <motion.aside
      animate={{ opacity: 1, x: 0 }}
      className="fixed left-0 top-0 z-50 hidden h-screen w-20 flex-col items-center border-r border-sidebar-border py-6 md:flex frosted-glass"
      initial={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Link aria-label="SIGMA" className="mb-8" href={`/${locale}`}>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary/90 shadow-lg shadow-sidebar-primary/20">
            <span className="text-lg font-bold text-sidebar-primary-foreground">S</span>
          </div>
        </motion.div>
      </Link>

      <span className="mb-4 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
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
                    layoutId="activeIndicator"
                    transition={{ damping: 30, stiffness: 300, type: "spring" }}
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

      <div className="mt-auto flex flex-col items-center gap-3">
        <motion.button
          aria-label={nextTheme === "light" ? t("themeLight") : t("themeDark")}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/60 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => setTheme(nextTheme)}
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {mounted && theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </motion.button>

        <motion.button
          aria-label={t("logout")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-accent text-sm font-semibold text-white ring-2 ring-sidebar-border transition-all duration-200 hover:ring-sidebar-primary/50"
          onClick={logout}
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {avatarLabel}
        </motion.button>
      </div>
    </motion.aside>
  );
}
