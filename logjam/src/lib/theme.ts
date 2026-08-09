export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "logjam-theme";

export function storedTheme(value: string | null): ResolvedTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveTheme(value: string | null, prefersDark: boolean): ResolvedTheme {
  return storedTheme(value) ?? (prefersDark ? "dark" : "light");
}

export function oppositeTheme(theme: ResolvedTheme): ResolvedTheme {
  return theme === "light" ? "dark" : "light";
}

export function applyDocumentTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#000000" : "#ffffff"
  );
}
