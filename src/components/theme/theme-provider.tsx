"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { applyTheme, readStoredTheme, type ThemeMode, THEME_STORAGE_KEY } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeMode;
  resolved: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  return readStoredTheme();
}

function getInitialResolvedTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [resolved, setResolved] = useState<"light" | "dark">(getInitialResolvedTheme);

  const apply = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setResolved(mode === "system" ? (document.documentElement.classList.contains("dark") ? "dark" : "light") : mode === "dark" ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, apply]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch {
        /* ignore */
      }
      apply(mode);
    },
    [apply],
  );

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
