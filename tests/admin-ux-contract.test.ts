import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cloudArchiveMutationSchema } from "@/admin/cloudflare-mutations";
import {
  isLogjamSubmissionPhotoPromotable,
  logjamAdminMutationSchema,
  logjamAdminSnapshotSchema,
  logjamAdminSubmissionDetailSchema
} from "@/admin/logjam-admin-api";
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

test("LogJam owner mutations target identities and immutable submissions only", () => {
  assert.deepEqual(logjamAdminMutationSchema.parse({
    action: "rename-user",
    userId: "user-1",
    displayName: " Curator One "
  }), {
    action: "rename-user",
    userId: "user-1",
    displayName: "Curator One"
  });

  assert.deepEqual(logjamAdminMutationSchema.parse({
    action: "rename-user",
    userId: "user-1",
    displayName: null
  }), {
    action: "rename-user",
    userId: "user-1",
    displayName: null
  });

  assert.deepEqual(logjamAdminMutationSchema.parse({
    action: "archive-submission",
    submissionId: "submission-1"
  }), {
    action: "archive-submission",
    submissionId: "submission-1"
  });

  assert.deepEqual(logjamAdminMutationSchema.parse({
    action: "promote-submission",
    submissionId: "submission-1",
    title: " Curator edit "
  }), {
    action: "promote-submission",
    submissionId: "submission-1",
    title: "Curator edit"
  });

  assert.throws(() => logjamAdminMutationSchema.parse({
    action: "promote-submission",
    submissionId: "submission-1",
    title: " "
  }));
});

test("LogJam admin snapshot separates mutable locked state from immutable versions", () => {
  const snapshot = logjamAdminSnapshotSchema.parse({
    users: [{
      id: "user-1",
      email: "curator@example.com",
      displayName: null,
      createdAt: "2026-08-05T00:00:00.000Z",
      lastSeenAt: "2026-08-05T01:00:00.000Z"
    }],
    curations: [{
      id: "curation-1",
      userId: "user-1",
      title: "Night walk",
      status: "active",
      locked: true,
      revision: 9,
      photoCount: 12,
      createdAt: "2026-08-05T00:10:00.000Z",
      updatedAt: "2026-08-05T01:10:00.000Z",
      submissions: [{
        id: "submission-1",
        version: 2,
        sourceRevision: 8,
        title: "Night walk v2",
        status: "submitted",
        photoCount: 10,
        submittedAt: "2026-08-05T01:05:00.000Z",
        promotedAlbumId: "album-1",
        promotedAlbumStatus: "published",
        promotedAt: "2026-08-05T01:08:00.000Z"
      }]
    }]
  });

  assert.equal(snapshot.curations[0].locked, true);
  assert.equal(snapshot.curations[0].revision, 9);
  assert.equal(snapshot.curations[0].submissions[0].sourceRevision, 8);
  assert.equal(snapshot.curations[0].submissions[0].promotedAlbumStatus, "published");
});

test("LogJam submission detail preserves missing photos so promotion can be blocked", () => {
  const detail = logjamAdminSubmissionDetailSchema.parse({
    submission: {
      id: "submission-1",
      curationId: "curation-1",
      userId: "user-1",
      userEmail: "curator@example.com",
      userDisplayName: "Curator One",
      version: 2,
      sourceRevision: 8,
      title: "Night walk v2",
      status: "submitted",
      photoCount: 2,
      submittedAt: "2026-08-05T01:05:00.000Z"
    },
    photos: [{
      id: "photo-1",
      position: 0,
      title: null,
      thumbUrl: null,
      displayUrl: null,
      width: null,
      height: null,
      available: false,
      published: false
    }]
  });

  assert.equal(detail.photos[0].available, false);
  assert.equal(detail.photos[0].thumbUrl, null);
  assert.equal(detail.photos[0].title, null);
  assert.equal(isLogjamSubmissionPhotoPromotable(detail.photos[0]), false);

  assert.equal(isLogjamSubmissionPhotoPromotable({
    ...detail.photos[0],
    available: true,
    published: false,
    thumbUrl: "https://assets.example.com/photo-1-thumb.jpg"
  }), false);

  assert.equal(isLogjamSubmissionPhotoPromotable({
    ...detail.photos[0],
    available: true,
    published: true,
    thumbUrl: "https://assets.example.com/photo-1-thumb.jpg"
  }), false);

  assert.equal(isLogjamSubmissionPhotoPromotable({
    ...detail.photos[0],
    available: true,
    published: true,
    thumbUrl: "https://assets.example.com/photo-1-thumb.jpg",
    displayUrl: "https://assets.example.com/photo-1-display.jpg"
  }), true);
});

test("LogJam admin keeps confirmations above review and refreshes dependent archive state", () => {
  const confirmDialogSource = readFileSync(
    new URL("../src/components/admin/AdminConfirmDialog.tsx", import.meta.url),
    "utf8"
  );
  const logjamAdminSource = readFileSync(
    new URL("../src/components/admin/LogjamAdmin.tsx", import.meta.url),
    "utf8"
  );
  const adminStyles = readFileSync(
    new URL("../src/styles/admin.css", import.meta.url),
    "utf8"
  );

  assert.match(confirmDialogSource, /createPortal\(/);
  assert.match(confirmDialogSource, /admin-modal-backdrop--confirm/);

  const baseLayer = adminStyles.match(/\.admin-modal-backdrop \{[\s\S]*?z-index:\s*(\d+);/);
  const confirmLayer = adminStyles.match(/\.admin-modal-backdrop--confirm \{[\s\S]*?z-index:\s*(\d+);/);
  assert.ok(baseLayer);
  assert.ok(confirmLayer);
  assert.ok(Number(confirmLayer[1]) > Number(baseLayer[1]));

  assert.match(logjamAdminSource, /adminArchiveActions\.refreshArchive/);
  assert.match(logjamAdminSource, /Retry overview/);
  assert.match(logjamAdminSource, /Retry photos/);
});
