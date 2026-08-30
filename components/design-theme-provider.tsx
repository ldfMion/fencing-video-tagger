"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export const DESIGN_THEMES = [
  {
    id: "linear",
    name: "Studio Midnight",
    description: "Glassy, focused, and luminous",
    previewClass:
      "bg-linear-to-br from-slate-100 via-indigo-400 to-slate-950",
  },
] as const;

export type DesignTheme = (typeof DESIGN_THEMES)[number]["id"];

const STORAGE_KEY = "fencing-video-tagger-design-theme";

interface DesignThemeContextValue {
  designTheme: DesignTheme;
  setDesignTheme: (theme: DesignTheme) => void;
}

const DesignThemeContext = createContext<DesignThemeContextValue | null>(null);

function isDesignTheme(value: string | null): value is DesignTheme {
  return DESIGN_THEMES.some((theme) => theme.id === value);
}

function getDesignThemeSnapshot(): DesignTheme {
  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  return isDesignTheme(storedTheme) ? storedTheme : "linear";
}

function subscribeToDesignTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("design-theme-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("design-theme-change", callback);
  };
}

function getServerDesignThemeSnapshot(): DesignTheme {
  return "linear";
}

export function DesignThemeProvider({ children }: { children: ReactNode }) {
  const designTheme = useSyncExternalStore(
    subscribeToDesignTheme,
    getDesignThemeSnapshot,
    getServerDesignThemeSnapshot,
  );

  const value = useMemo<DesignThemeContextValue>(
    () => ({
      designTheme,
      setDesignTheme: (theme) => {
        window.localStorage.setItem(STORAGE_KEY, theme);
        document.documentElement.dataset.designTheme = theme;
        window.dispatchEvent(new Event("design-theme-change"));
      },
    }),
    [designTheme],
  );

  return (
    <DesignThemeContext.Provider value={value}>
      {children}
    </DesignThemeContext.Provider>
  );
}

export function useDesignTheme() {
  const context = useContext(DesignThemeContext);

  if (!context) {
    throw new Error("useDesignTheme must be used within DesignThemeProvider");
  }

  return context;
}
