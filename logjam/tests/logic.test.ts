import { describe, expect, it } from "vitest";

import {
  MAX_PHOTOS_PER_CURATION,
  moveItem,
  normalizePhotoIds,
  normalizeTitle,
  parsePendingDecision,
  safeReturnTo
} from "../shared/logic";

describe("safeReturnTo", () => {
  it("keeps local paths with query and hash", () => {
    expect(safeReturnTo("/albums/night?from=one#frame")).toBe("/albums/night?from=one#frame");
  });

  it.each([
    "https://attacker.test/steal",
    "//attacker.test/steal",
    "/auth/start?returnTo=/auth/start"
  ])("rejects unsafe redirect %s", (value) => {
    expect(safeReturnTo(value)).toBe("/");
  });
});

describe("curation validation", () => {
  it("normalizes titles but rejects blanks and oversized values", () => {
    expect(normalizeTitle("  A   quiet\nsequence ")).toBe("A quiet sequence");
    expect(normalizeTitle("   ")).toBeNull();
    expect(normalizeTitle("x".repeat(161))).toBeNull();
  });

  it("requires unique bounded photo IDs", () => {
    expect(normalizePhotoIds(["one", "two"])).toEqual(["one", "two"]);
    expect(normalizePhotoIds(["one", "one"])).toBeNull();
    expect(normalizePhotoIds(Array.from({ length: MAX_PHOTOS_PER_CURATION + 1 }, (_, i) => `p${i}`))).toBeNull();
  });

  it("moves an item without mutating the input", () => {
    const source = ["a", "b", "c"];
    expect(moveItem(source, 0, 2)).toEqual(["b", "c", "a"]);
    expect(source).toEqual(["a", "b", "c"]);
  });
});

describe("pending decision", () => {
  it("accepts only a bounded keep/pass action", () => {
    expect(parsePendingDecision(JSON.stringify({
      kind: "decision",
      photoId: "photo-1",
      decision: "keep",
      returnTo: "/albums/one"
    }))).toEqual({ kind: "decision", photoId: "photo-1", decision: "keep", returnTo: "/albums/one" });
    expect(parsePendingDecision('{"kind":"decision","photoId":"p","decision":"maybe"}')).toBeNull();
  });
});
