"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

type ThemeMode = "system" | "light" | "dark";

const modes: ThemeMode[] = ["system", "dark", "light"];

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "system";
    }
    const stored = window.localStorage.getItem("yakov-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return "system";
  });

  function cycleTheme() {
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    setMode(next);

    if (next === "system") {
      window.localStorage.removeItem("yakov-theme");
      delete document.documentElement.dataset.theme;
      return;
    }

    window.localStorage.setItem("yakov-theme", next);
    document.documentElement.dataset.theme = next;
  }

  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Theme: ${mode}. Change theme`}
      title={`Theme: ${mode}`}
      onClick={cycleTheme}
      suppressHydrationWarning
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
