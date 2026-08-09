import { describe, expect, it } from "vitest";

import type { AlbumDecisionProgress } from "../shared/contracts";
import {
  formatAlbumProgress,
  isAlbumFullyDecided,
  shouldLockAlbumNavigation
} from "../src/lib/catalogProgress";

function progress(overrides: Partial<AlbumDecisionProgress> = {}): AlbumDecisionProgress {
  return {
    albumId: "album-1",
    keptCount: 5,
    passedCount: 7,
    totalCount: 12,
    ...overrides
  };
}

describe("catalog decision progress", () => {
  it("formats the two decision buckets without exposing them to anonymous users", () => {
    expect(formatAlbumProgress(progress())).toBe("5 kept · 7 passed");
  });

  it("marks only a non-empty, fully decided album complete", () => {
    expect(isAlbumFullyDecided(progress())).toBe(true);
    expect(isAlbumFullyDecided(progress({ passedCount: 6 }))).toBe(false);
    expect(isAlbumFullyDecided(progress({ keptCount: 0, passedCount: 0, totalCount: 0 }))).toBe(false);
    expect(isAlbumFullyDecided(undefined)).toBe(false);
  });

  it("keeps authenticated cards locked until progress is known", () => {
    expect(shouldLockAlbumNavigation("loading", undefined)).toBe(true);
    expect(shouldLockAlbumNavigation("error", undefined)).toBe(true);
    expect(shouldLockAlbumNavigation("anonymous", undefined)).toBe(false);
    expect(shouldLockAlbumNavigation("ready", undefined)).toBe(false);
    expect(shouldLockAlbumNavigation("ready", progress())).toBe(true);
  });
});
