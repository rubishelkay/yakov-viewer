import { describe, expect, it } from "vitest";

import {
  appendDecisionUndo,
  beginDecisionUndoSession,
  endDecisionUndoSession,
  popDecisionUndo,
  removePhotoFromDecisionUndo,
  type DecisionUndoEntry
} from "../src/state/decisionHistory";

const first: DecisionUndoEntry = {
  photoId: "photo-1",
  previous: undefined,
  next: "keep",
  expectedUpdatedAt: "version-1"
};
const second: DecisionUndoEntry = {
  photoId: "photo-2",
  previous: "keep",
  next: "pass",
  expectedUpdatedAt: "version-2",
  context: "album-2"
};

describe("feed decision undo history", () => {
  it("restores decisions in reverse action order", () => {
    const history = appendDecisionUndo(appendDecisionUndo([], first), second);
    const latest = popDecisionUndo(history);
    const earlier = popDecisionUndo(latest.remaining);

    expect(latest.entry).toEqual(second);
    expect(earlier.entry).toEqual(first);
    expect(earlier.remaining).toEqual([]);
  });

  it("can put a failed undo back on top without changing its meaning", () => {
    const popped = popDecisionUndo([first, second]);
    const restored = popped.entry
      ? appendDecisionUndo(popped.remaining, popped.entry)
      : popped.remaining;

    expect(restored).toEqual([first, second]);
  });

  it("invalidates stale feed history after an untracked account change", () => {
    expect(removePhotoFromDecisionUndo([first, second], "photo-1")).toEqual([second]);
  });

  it("keeps history for the same feed session and clears it across routes", () => {
    const initial = { sessionId: null, history: [] };
    const firstFeed = beginDecisionUndoSession(initial, "boring-film-59");
    const withDecision = { ...firstFeed, history: [first] };

    expect(beginDecisionUndoSession(withDecision, "boring-film-59")).toBe(withDecision);
    expect(endDecisionUndoSession(withDecision, "another-feed")).toBe(withDecision);
    expect(beginDecisionUndoSession(withDecision, "boring-film-60")).toEqual({
      sessionId: "boring-film-60",
      history: []
    });
    expect(endDecisionUndoSession(withDecision, "boring-film-59")).toEqual({
      sessionId: null,
      history: []
    });
  });
});
