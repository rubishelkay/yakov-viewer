import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
  applyDocumentTheme,
  oppositeTheme,
  resolveTheme,
  storedTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme
} from "../lib/theme";

function readStoredTheme(): ResolvedTheme | null {
  try {
    return storedTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function initialTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return resolveTheme(readStoredTheme(), window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ResolvedTheme>(initialTheme);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const next = resolveTheme(readStoredTheme(), preference.matches);
      setTheme(next);
      applyDocumentTheme(next);
    };
    const syncSystemTheme = () => {
      if (!readStoredTheme()) syncTheme();
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) syncTheme();
    };

    syncTheme();
    preference.addEventListener("change", syncSystemTheme);
    window.addEventListener("storage", syncStoredTheme);
    return () => {
      preference.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("storage", syncStoredTheme);
    };
  }, []);

  const nextTheme = oppositeTheme(theme);
  const Icon = theme === "light" ? Sun : Moon;

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={() => {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
          // The current page can still switch when storage is unavailable.
        }
        setTheme(nextTheme);
        applyDocumentTheme(nextTheme);
      }}
    >
      <Icon aria-hidden="true" strokeWidth={1.7} />
    </button>
  );
}
