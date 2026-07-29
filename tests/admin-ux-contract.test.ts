import assert from "node:assert/strict";
import test from "node:test";

import { cloudArchiveMutationSchema } from "@/admin/cloudflare-mutations";
import {
  nextPublicAlbumCount,
  publicAlbumBatchSize
} from "@/lib/progressive-albums";

test("set mutations accept absolute drag order and unique multi-set membership", () => {
  assert.deepEqual(cloudArchiveMutationSchema.parse({
    action: "moveAlbumInSet",
    albumId: "album-1",
    position: 7,
    setId: "set-1"
  }), {
    action: "moveAlbumInSet",
    albumId: "album-1",
    position: 7,
    setId: "set-1"
  });

  assert.deepEqual(cloudArchiveMutationSchema.parse({
    action: "setAlbumSets",
    albumId: "album-1",
    setIds: ["set-1", "set-2"]
  }), {
    action: "setAlbumSets",
    albumId: "album-1",
    setIds: ["set-1", "set-2"]
  });

  assert.throws(() => cloudArchiveMutationSchema.parse({
    action: "setAlbumSets",
    albumId: "album-1",
    setIds: ["set-1", "set-1"]
  }));
});

test("public album batches grow by fifteen and stop at the total", () => {
  assert.equal(publicAlbumBatchSize, 15);
  assert.equal(nextPublicAlbumCount(0, 40), 15);
  assert.equal(nextPublicAlbumCount(15, 40), 30);
  assert.equal(nextPublicAlbumCount(30, 40), 40);
  assert.equal(nextPublicAlbumCount(40, 40), 40);
});
