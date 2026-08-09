import type { DecisionValue, PendingDecision } from "./contracts";

export const MAX_CURATIONS_PER_USER = 20;
export const MAX_PHOTOS_PER_CURATION = 500;
export const MAX_CURATION_TITLE_LENGTH = 160;
export const MAX_SUBMISSIONS_PER_CURATION = 20;
export const MAX_SUBMISSIONS_PER_USER = 50;

export function isDecision(value: unknown): value is DecisionValue {
  return value === "keep" || value === "pass";
}

export function normalizeTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim();
  if (!title || title.length > MAX_CURATION_TITLE_LENGTH) return null;
  return title;
}

export function normalizePhotoIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_PHOTOS_PER_CURATION) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    const id = raw.trim();
    if (!id || id.length > 128 || seen.has(id)) return null;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://logjam.invalid");
    if (parsed.origin !== "https://logjam.invalid") return fallback;
    if (parsed.pathname === "/auth/start" || parsed.pathname === "/auth/start/") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function parsePendingDecision(value: string | null): PendingDecision | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PendingDecision>;
    if (
      parsed.kind !== "decision" ||
      typeof parsed.photoId !== "string" ||
      !parsed.photoId ||
      parsed.photoId.length > 128 ||
      !isDecision(parsed.decision)
    ) return null;
    return {
      kind: "decision",
      photoId: parsed.photoId,
      decision: parsed.decision,
      returnTo: safeReturnTo(parsed.returnTo)
    };
  } catch {
    return null;
  }
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
