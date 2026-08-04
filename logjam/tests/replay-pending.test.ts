import { describe, expect, it, vi } from "vitest";

import type { DecisionRecord } from "../shared/contracts";
import { replayPendingDecisionState } from "../src/state/replayPending";

const saved: DecisionRecord = {
  photoId: "photo-1",
  decision: "keep",
  updatedAt: "2026-08-05T00:00:00.000Z"
};

describe("pending decision replay", () => {
  it("clears the pending action only after write, then hydrates every decision", async () => {
    const order: string[] = [];
    const all: DecisionRecord[] = [
      saved,
      { photoId: "photo-2", decision: "pass", updatedAt: saved.updatedAt }
    ];
    await replayPendingDecisionState({
      write: async () => { order.push("write"); return saved; },
      afterSuccessfulWrite: () => order.push("clear-pending"),
      loadAll: async () => { order.push("load-account"); return all; },
      hydrate: (records) => { order.push(`hydrate-${records.length}`); },
      onRefreshError: vi.fn()
    });
    expect(order).toEqual(["write", "clear-pending", "load-account", "hydrate-2"]);
  });

  it("keeps the pending action when the write fails", async () => {
    const afterSuccessfulWrite = vi.fn();
    await expect(replayPendingDecisionState({
      write: async () => { throw new Error("offline"); },
      afterSuccessfulWrite,
      loadAll: vi.fn(),
      hydrate: vi.fn(),
      onRefreshError: vi.fn()
    })).rejects.toThrow("offline");
    expect(afterSuccessfulWrite).not.toHaveBeenCalled();
  });
});
