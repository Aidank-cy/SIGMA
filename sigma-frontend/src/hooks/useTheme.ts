"use client";

import { useCallback, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_KEY = "sigma.theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const isDark = theme === "dark";

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const initialTheme: ThemeMode = stored === "dark" ? "dark" : "light";
    setThemeState(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  return { isDark, setTheme, theme, toggleTheme };
}
