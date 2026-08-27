import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type ThemeAccent = "violet" | "blue" | "green";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: ThemeAccent;
  toggleMode: () => void;
  setAccent: (accent: ThemeAccent) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem("themeMode");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialAccent(): ThemeAccent {
  const stored = localStorage.getItem("themeAccent");
  if (stored === "violet" || stored === "blue" || stored === "green") return stored;
  return "violet";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const [accent, setAccentState] = useState<ThemeAccent>(getInitialAccent);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    localStorage.setItem("themeMode", mode);
  }, [mode]);

  useEffect(() => {
    if (accent === "violet") {
      delete document.documentElement.dataset.accent;
    } else {
      document.documentElement.dataset.accent = accent;
    }
    localStorage.setItem("themeAccent", accent);
  }, [accent]);

  function toggleMode() {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  }

  function setAccent(next: ThemeAccent) {
    setAccentState(next);
  }

  return <ThemeContext.Provider value={{ mode, accent, toggleMode, setAccent }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
