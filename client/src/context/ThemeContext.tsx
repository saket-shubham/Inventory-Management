import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  resetToLight: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Every fresh login starts on light mode, regardless of what was picked last
  // time (and regardless of the OS/browser's dark-mode preference) — a manual
  // toggle only lasts for that logged-in session.
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  function toggleMode() {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  }

  function resetToLight() {
    setMode("light");
  }

  return <ThemeContext.Provider value={{ mode, toggleMode, resetToLight }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
