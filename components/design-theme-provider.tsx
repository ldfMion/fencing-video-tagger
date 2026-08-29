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
    id: "classic",
    name: "Classic",
    description: "Focused, neutral, and compact",
    previewClass:
      "bg-linear-to-br from-slate-50 to-slate-300 dark:from-slate-700 dark:to-slate-950",
  },
  {
    id: "prism",
    name: "Smoked Glass",
    description: "Monochrome, luminous, and expressive",
    previewClass: "bg-linear-to-br from-white via-zinc-400 to-black",
  },
  {
    id: "brutalist",
    name: "Brutalist",
    description: "Bold, structural, and contemporary",
    previewClass:
      "rounded-none! border-2! border-black! bg-[linear-gradient(135deg,#60d5d0_0_50%,#050b0d_50%)] shadow-[3px_3px_0_#60d5d0]!",
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
  return isDesignTheme(storedTheme) ? storedTheme : "classic";
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
  return "classic";
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
