"use client";

import {
  BarChart3,
  FileText,
  Home,
  LogOut,
  Menu,
  Moon,
  Settings,
  Star,
  Sun,
  UserCircle
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "", icon: Home, key: "home" },
  { href: "watchlist", icon: Star, key: "watchlist" },
  { href: "reports", icon: FileText, key: "reports" },
  { href: "settings", icon: Settings, key: "settings" }
] as const;

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const { logout, user } = useAuth();
  const locale = useLocale();
  const t = useTranslations("nav");
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setIsAtTop(window.scrollY === 0));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b backdrop-blur-xl transition-colors",
          isAtTop
            ? "border-transparent bg-transparent"
            : "border-sigma-line bg-sigma-bg/82"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" href={`/${locale}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sigma-text text-sigma-bg">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-normal text-sigma-text">SIGMA</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                  href={`/${locale}/${item.href}`}
                  key={item.key}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <LocaleSwitcher compact />
            <Button aria-label={isDark ? t("themeLight") : t("themeDark")} onClick={toggleTheme} size="sm" variant="ghost">
              {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-sigma-line bg-sigma-elevated px-3 py-1.5">
              <UserCircle className="h-5 w-5 text-sigma-muted" aria-hidden />
              <span className="max-w-32 truncate text-sm font-medium text-sigma-text">
                {user?.display_name}
              </span>
            </div>
            <Button aria-label={t("logout")} onClick={logout} size="sm" variant="ghost">
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <button
            aria-label={t("menu")}
            className="rounded-full p-2 text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text md:hidden"
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>

        <div
          className={cn(
            "border-t border-sigma-line px-4 py-3 md:hidden",
            isOpen ? "block" : "hidden"
          )}
        >
          <div className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="inline-flex h-11 items-center gap-3 rounded-full px-4 text-sm font-medium text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                  href={`/${locale}/${item.href}`}
                  key={item.key}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(item.key)}
                </Link>
              );
            })}
            <div className="flex items-center justify-between gap-3 pt-2">
              <LocaleSwitcher compact />
              <Button aria-label={isDark ? t("themeLight") : t("themeDark")} onClick={toggleTheme} size="sm" variant="ghost">
                {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
              </Button>
              <Button onClick={logout} size="sm" variant="ghost">
                <LogOut className="h-4 w-4" aria-hidden />
                {t("logout")}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sigma-line bg-sigma-bg/88 px-3 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-sm grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="flex h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                href={`/${locale}/${item.href}`}
                key={item.key}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
