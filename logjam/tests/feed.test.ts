import { describe, expect, it } from "vitest";

import type { AlbumDetail, DecisionValue } from "../shared/contracts";
import {
  decisionFromArrowShortcut,
  isAlbumDecisionComplete,
  shouldRenderAlbumInFeed
} from "../src/lib/feed";

function album(photoIds: string[]): Pick<AlbumDetail, "id" | "photos"> {
  return {
    id: "album-1",
    photos: photoIds.map((id) => ({
      id,
      slug: id,
      title: id,
      width: 100,
      height: 100,
      thumbUrl: `/${id}-thumb.jpg`,
      displayUrl: `/${id}.jpg`
    }))
  };
}

describe("continuous album feed", () => {
  it("recognizes complete and empty albums as having no sorting work", () => {
    const decisions: Record<string, DecisionValue> = { a: "keep", b: "pass" };
    expect(isAlbumDecisionComplete(album(["a", "b"]), decisions)).toBe(true);
    expect(isAlbumDecisionComplete(album([]), decisions)).toBe(true);
    expect(isAlbumDecisionComplete(album(["a", "c"]), decisions)).toBe(false);
  });

  it("holds a newly completed album only while its last card exits", () => {
    const complete = album(["a"]);
    const decisions: Record<string, DecisionValue> = { a: "keep" };
    expect(shouldRenderAlbumInFeed(complete, decisions, new Set(["album-1:a"]))).toBe(true);
    expect(shouldRenderAlbumInFeed(complete, decisions, new Set())).toBe(false);
  });

  it("maps only unmodified horizontal arrows to decisions", () => {
    const shortcut = (key: string, modifiers: Partial<{
      metaKey: boolean;
      ctrlKey: boolean;
      altKey: boolean;
      shiftKey: boolean;
    }> = {}) => decisionFromArrowShortcut({
      key,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      ...modifiers
    });

    expect(shortcut("ArrowLeft")).toBe("pass");
    expect(shortcut("ArrowRight")).toBe("keep");
    expect(shortcut("ArrowLeft", { metaKey: true })).toBeNull();
    expect(shortcut("ArrowRight", { ctrlKey: true })).toBeNull();
    expect(shortcut("ArrowLeft", { altKey: true })).toBeNull();
    expect(shortcut("ArrowRight", { shiftKey: true })).toBeNull();
    expect(shortcut("ArrowUp")).toBeNull();
  });
});
