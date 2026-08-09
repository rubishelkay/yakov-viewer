import { describe, expect, it } from "vitest";

import type { AccountPayload, AccountPhoto } from "../shared/contracts";
import { reclassifyAccountPhoto } from "../src/lib/account";

const photo: AccountPhoto = {
  id: "photo-1",
  slug: "photo-1",
  title: "000029080038",
  width: 1200,
  height: 800,
  thumbUrl: "https://images.example/thumb.jpg",
  displayUrl: "https://images.example/display.jpg",
  sourceAlbumTitle: "boring film #70"
};

function account(): AccountPayload {
  return {
    viewer: { id: "user-1", email: "curator@example.com", displayName: "Curator" },
    decisions: [{ photoId: photo.id, decision: "keep", updatedAt: "2026-08-08T00:00:00.000Z" }],
    curations: [],
    keptPhotos: [photo],
    passedPhotos: []
  };
}

describe("account photo reclassification", () => {
  it("moves a kept photograph to passed and updates its local decision", () => {
    const result = reclassifyAccountPhoto(account(), photo.id, "pass", "2026-08-09T00:00:00.000Z");

    expect(result.keptPhotos).toEqual([]);
    expect(result.passedPhotos).toEqual([photo]);
    expect(result.decisions[0]).toEqual({
      photoId: photo.id,
      decision: "pass",
      updatedAt: "2026-08-09T00:00:00.000Z"
    });
  });

  it("supports an optimistic rollback to the previous section", () => {
    const moved = reclassifyAccountPhoto(account(), photo.id, "pass", "2026-08-09T00:00:00.000Z");
    const restored = reclassifyAccountPhoto(moved, photo.id, "keep", "2026-08-08T00:00:00.000Z");

    expect(restored.keptPhotos).toEqual([photo]);
    expect(restored.passedPhotos).toEqual([]);
    expect(restored.decisions[0]?.decision).toBe("keep");
  });

  it("does not mutate the account when the photo is absent", () => {
    const original = account();
    expect(reclassifyAccountPhoto(original, "missing", "pass")).toBe(original);
  });
});
