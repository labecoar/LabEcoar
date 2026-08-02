import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  applyThemeMode,
  getThemeMode,
  getThemePalette,
  getThemeTokens,
  subscribeTheme,
  C,
} from "@/lib/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Garante re-render de todo consumidor quando applyThemeMode notifica
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode, () => "dark");
  const colors = useSyncExternalStore(subscribeTheme, getThemePalette, getThemePalette);

  const setMode = useCallback((nextMode) => {
    applyThemeMode(nextMode === "light" ? "light" : "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    applyThemeMode(getThemeMode() === "dark" ? "light" : "dark");
  }, []);

  const tokens = useMemo(() => getThemeTokens(mode === "light"), [mode]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleTheme,
      isLight: mode === "light",
      isDark: mode === "dark",
      colors,
      tokens,
      T: tokens,
      C,
    }),
    [mode, setMode, toggleTheme, colors, tokens]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }
  return ctx;
}
