import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import {
  applyLogjamAdminMutation,
  LogjamAdminError,
  readLogjamAdminOverview,
  readLogjamAdminSubmission
} from "@/server/cloudflare/logjam-admin";
import { validateLogjamAdminMutationRequest } from "@/server/cloudflare/logjam-admin-contract";
import { submitCuration } from "../logjam/worker/repository";

const timestamp = "2026-08-05T12:00:00.000Z";

test("LogJam admin mutations require same-origin JSON", () => {
  const valid = validateLogjamAdminMutationRequest(new Request(
    "https://yakov.shmol.cc/api/admin/logjam/mutations",
    {
      method: "POST",
      headers: {
        origin: "https://yakov.shmol.cc",
        "content-type": "application/json; charset=utf-8"
      },
      body: "{}"
    }
  ));
  assert.deepEqual(valid, { ok: true });

  const crossOrigin = validateLogjamAdminMutationRequest(new Request(
    "https://yakov.shmol.cc/api/admin/logjam/mutations",
    {
      method: "POST",
      headers: { origin: "https://attacker.test", "content-type": "application/json" },
      body: "{}"
    }
  ));
  assert.equal(crossOrigin.ok, false);
  if (!crossOrigin.ok) assert.equal(crossOrigin.code, "csrf_rejected");

  const plainText = validateLogjamAdminMutationRequest(new Request(
    "https://yakov.shmol.cc/api/admin/logjam/mutations",
    {
      method: "POST",
      headers: { origin: "https://yakov.shmol.cc", "content-type": "text/plain" },
      body: "{}"
    }
  ));
  assert.equal(plainText.ok, false);
  if (!plainText.ok) assert.equal(plainText.code, "json_required");
});

test("LogJam decisions are global per user and canonical photo", () => {
  const fixture = createFixture();
  try {
    fixture.sqlite.prepare(`
      INSERT INTO logjam_decisions (user_id, photo_id, decision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run("user-1", "photo-1", "keep", timestamp, timestamp);

    assert.throws(() => fixture.sqlite.prepare(`
      INSERT INTO logjam_decisions (user_id, photo_id, decision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run("user-1", "photo-1", "pass", timestamp, timestamp));

    fixture.sqlite.prepare(`
      INSERT INTO logjam_decisions (user_id, photo_id, decision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, photo_id) DO UPDATE SET
        decision = excluded.decision,
        updated_at = excluded.updated_at
    `).run("user-1", "photo-1", "pass", timestamp, "2026-08-05T12:05:00.000Z");

    fixture.sqlite.prepare(`
      INSERT INTO logjam_decisions (user_id, photo_id, decision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run("user-2", "photo-1", "keep", timestamp, timestamp);

    const rows = fixture.sqlite.prepare(`
      SELECT user_id, photo_id, decision FROM logjam_decisions ORDER BY user_id
    `).all().map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { user_id: "user-1", photo_id: "photo-1", decision: "pass" },
      { user_id: "user-2", photo_id: "photo-1", decision: "keep" }
    ]);
    const columns = fixture.sqlite.prepare("PRAGMA table_info(logjam_decisions)").all();
    assert.equal(columns.some((column) => column.name === "album_id"), false);
  } finally {
    fixture.sqlite.close();
  }
});

test("submitted versions remain isolated from later working-curation edits", async () => {
  const fixture = createFixture();
  try {
    const before = await readLogjamAdminSubmission(fixture.d1, "submission-1");
    assert.deepEqual(before.photos.map((photo) => photo.id), ["photo-1", "photo-2"]);

    fixture.sqlite.exec("BEGIN");
    fixture.sqlite.prepare("DELETE FROM logjam_curation_items WHERE curation_id = ?")
      .run("curation-1");
    fixture.sqlite.prepare(`
      INSERT INTO logjam_curation_items (curation_id, photo_id, position, created_at)
      VALUES (?, ?, ?, ?), (?, ?, ?, ?)
    `).run(
      "curation-1", "photo-2", 0, timestamp,
      "curation-1", "photo-3", 1, timestamp
    );
    fixture.sqlite.prepare(`
      UPDATE logjam_curations SET revision = 2, updated_at = ? WHERE id = ?
    `).run("2026-08-05T12:10:00.000Z", "curation-1");
    fixture.sqlite.exec("COMMIT");

    const after = await readLogjamAdminSubmission(fixture.d1, "submission-1");
    assert.deepEqual(after.photos.map((photo) => photo.id), ["photo-1", "photo-2"]);
    assert.throws(() => fixture.sqlite.prepare(`
      UPDATE logjam_submission_items SET photo_id = ?
      WHERE submission_id = ? AND photo_id = ?
    `).run("photo-3", "submission-1", "photo-1"), /immutable/);
    assert.throws(() => fixture.sqlite.prepare(`
      UPDATE logjam_submissions SET title = ? WHERE id = ?
    `).run("Changed snapshot", "submission-1"), /immutable/);
    assert.throws(() => fixture.sqlite.prepare(`
      INSERT INTO logjam_submission_items (submission_id, photo_id, position, created_at)
      VALUES (?, ?, ?, ?)
    `).run("submission-1", "photo-3", 2, timestamp), /after sealing/);
  } finally {
    fixture.sqlite.close();
  }
});

test("promotion is atomic, creates one draft album, copies no assets, and is idempotent", async () => {
  const fixture = createFixture();
  try {
    const assetCountBefore = scalarNumber(fixture.sqlite, "SELECT COUNT(*) AS value FROM archive_assets");
    const [first, racedRetry] = await Promise.all([
      applyLogjamAdminMutation(fixture.d1, {
        action: "promote-submission",
        submissionId: "submission-1"
      }),
      applyLogjamAdminMutation(fixture.d1, {
        action: "promote-submission",
        submissionId: "submission-1",
        title: "A retry must not create another album"
      })
    ]);
    if (!("albumId" in first) || !("albumId" in racedRetry)) {
      assert.fail("Expected promotion results.");
    }

    assert.equal(first.albumId, racedRetry.albumId);
    assert.deepEqual([first.created, racedRetry.created].sort(), [false, true]);
    assert.equal(first.albumStatus, "draft");
    assert.equal(racedRetry.albumStatus, "draft");
    assert.equal(
      scalarNumber(fixture.sqlite, "SELECT COUNT(*) AS value FROM archive_albums WHERE id = ?", first.albumId),
      1
    );
    assert.deepEqual(fixture.sqlite.prepare(`
      SELECT photo_id, position FROM album_photos WHERE album_id = ? ORDER BY position
    `).all(first.albumId).map((row) => ({ ...row })), [
      { photo_id: "photo-1", position: 1 },
      { photo_id: "photo-2", position: 2 }
    ]);
    assert.equal(
      scalarNumber(fixture.sqlite, "SELECT COUNT(*) AS value FROM archive_assets"),
      assetCountBefore
    );

    fixture.sqlite.prepare(`
      UPDATE archive_albums SET status = 'published', published_at = ? WHERE id = ?
    `).run(timestamp, first.albumId);
    const overview = await readLogjamAdminOverview(fixture.d1);
    assert.equal(overview.curations[0].locked, true);
    assert.equal(overview.curations[0].submissions[0].promotedAlbumStatus, "published");

    fixture.sqlite.prepare("UPDATE archive_albums SET status = 'hidden' WHERE id = ?")
      .run(first.albumId);
    const afterUnpublish = await readLogjamAdminOverview(fixture.d1);
    assert.equal(afterUnpublish.curations[0].locked, true);
    assert.equal(afterUnpublish.curations[0].submissions[0].promotedAlbumStatus, "hidden");

    fixture.sqlite.prepare("DELETE FROM archive_albums WHERE id = ?").run(first.albumId);
    const afterPurge = await readLogjamAdminOverview(fixture.d1);
    assert.equal(afterPurge.curations[0].locked, true);
    assert.equal(afterPurge.curations[0].submissions[0].promotedAlbumStatus, undefined);
    assert.throws(() => fixture.sqlite.prepare(`
      UPDATE logjam_submissions SET source_locked_at = NULL WHERE id = 'submission-1'
    `).run(), /irreversible/);
  } finally {
    fixture.sqlite.close();
  }
});

test("purging a mutable source photo bumps the working-curation revision", () => {
  const fixture = createFixture();
  try {
    assert.equal(
      scalarNumber(fixture.sqlite, "SELECT revision AS value FROM logjam_curations WHERE id = 'curation-1'"),
      1
    );
    fixture.sqlite.prepare("DELETE FROM archive_photos WHERE id = 'photo-1'").run();
    assert.equal(
      scalarNumber(fixture.sqlite, "SELECT revision AS value FROM logjam_curations WHERE id = 'curation-1'"),
      2
    );
    assert.equal(
      scalarNumber(fixture.sqlite, "SELECT COUNT(*) AS value FROM logjam_curation_items WHERE curation_id = 'curation-1'"),
      1
    );
    assert.deepEqual(fixture.sqlite.prepare(`
      SELECT photo_id FROM logjam_submission_items
      WHERE submission_id = 'submission-1' ORDER BY position
    `).all().map((row) => row.photo_id), ["photo-1", "photo-2"]);
  } finally {
    fixture.sqlite.close();
  }
});

test("submit rejects an ordered-membership change even when its revision was not bumped", async () => {
  const fixture = createFixture();
  try {
    fixture.sqlite.prepare(`
      INSERT INTO archive_albums (
        id, slug, title, status, is_demo, public_download_policy,
        sort_order, created_at, updated_at, published_at
      ) VALUES ('source-album', 'source-album', 'Source', 'published', 0, 'none', 0, ?, ?, ?)
    `).run(timestamp, timestamp, timestamp);
    fixture.sqlite.prepare(`
      INSERT INTO album_photos (album_id, photo_id, position, created_at)
      VALUES ('source-album', 'photo-1', 0, ?), ('source-album', 'photo-2', 1, ?)
    `).run(timestamp, timestamp);
    fixture.sqlite.prepare(`
      INSERT INTO logjam_decisions (user_id, photo_id, decision, created_at, updated_at)
      VALUES ('user-1', 'photo-1', 'keep', ?, ?), ('user-1', 'photo-2', 'keep', ?, ?)
    `).run(timestamp, timestamp, timestamp, timestamp);
    fixture.sqlite.prepare(`
      INSERT INTO logjam_curations (id, user_id, title, status, revision, created_at, updated_at)
      VALUES ('curation-race', 'user-1', 'Race selection', 'active', 1, ?, ?)
    `).run(timestamp, timestamp);
    fixture.sqlite.prepare(`
      INSERT INTO logjam_curation_items (curation_id, photo_id, position, created_at)
      VALUES ('curation-race', 'photo-1', 0, ?), ('curation-race', 'photo-2', 1, ?)
    `).run(timestamp, timestamp);

    fixture.adapter.beforeNextBatch(() => {
      fixture.sqlite.prepare(`
        DELETE FROM logjam_curation_items
        WHERE curation_id = 'curation-race' AND photo_id = 'photo-1'
      `).run();
    });
    await assert.rejects(
      submitCuration(fixture.d1, "user-1", "curation-race"),
      (error) => Boolean(
        error && typeof error === "object" && "code" in error && error.code === "curation_changed"
      )
    );
    assert.equal(
      scalarNumber(fixture.sqlite, `
        SELECT COUNT(*) AS value FROM logjam_submissions WHERE curation_id = 'curation-race'
      `),
      0
    );
  } finally {
    fixture.sqlite.close();
  }
});

test("promotion rejects archived submissions and unavailable source photos", async () => {
  const fixture = createFixture();
  try {
    seedSubmission(fixture.sqlite, {
      id: "submission-review-photo",
      version: 2,
      sourceRevision: 2,
      photoId: "photo-3"
    });
    await assert.rejects(
      applyLogjamAdminMutation(fixture.d1, {
        action: "promote-submission",
        submissionId: "submission-review-photo"
      }),
      (error) => error instanceof LogjamAdminError && error.code === "source_photos_unavailable"
    );

    seedSubmission(fixture.sqlite, {
      id: "submission-missing-photo",
      version: 3,
      sourceRevision: 3,
      photoId: "photo-missing"
    });
    await assert.rejects(
      applyLogjamAdminMutation(fixture.d1, {
        action: "promote-submission",
        submissionId: "submission-missing-photo"
      }),
      (error) => error instanceof LogjamAdminError && error.code === "source_photos_unavailable"
    );

    seedSubmission(fixture.sqlite, {
      id: "submission-missing-asset",
      version: 5,
      sourceRevision: 5,
      photoId: "photo-2"
    });
    fixture.sqlite.prepare(`
      DELETE FROM archive_assets WHERE photo_id = 'photo-2' AND version = 'thumb'
    `).run();
    await assert.rejects(
      applyLogjamAdminMutation(fixture.d1, {
        action: "promote-submission",
        submissionId: "submission-missing-asset"
      }),
      (error) => error instanceof LogjamAdminError && error.code === "source_photos_unavailable"
    );

    seedSubmission(fixture.sqlite, {
      id: "submission-archived",
      version: 6,
      sourceRevision: 6,
      photoId: "photo-1"
    });
    const archived = await applyLogjamAdminMutation(fixture.d1, {
      action: "archive-submission",
      submissionId: "submission-archived"
    });
    if (!("status" in archived)) assert.fail("Expected archive result.");
    assert.equal(archived.status, "archived");
    await assert.rejects(
      applyLogjamAdminMutation(fixture.d1, {
        action: "promote-submission",
        submissionId: "submission-archived"
      }),
      (error) => error instanceof LogjamAdminError && error.code === "submission_archived"
    );

    assert.equal(
      scalarNumber(fixture.sqlite, `
        SELECT COUNT(*) AS value
        FROM logjam_submissions
        WHERE id IN (
          'submission-review-photo',
          'submission-missing-photo',
          'submission-missing-asset',
          'submission-archived'
        )
          AND promoted_album_id IS NOT NULL
      `),
      0
    );
  } finally {
    fixture.sqlite.close();
  }
});

test("promotion rechecks archived state and photo eligibility inside its batch", async () => {
  const archivedFixture = createFixture();
  try {
    archivedFixture.adapter.beforeNextBatch(() => {
      archivedFixture.sqlite.prepare(`
        UPDATE logjam_submissions
        SET status = 'archived', archived_at = ?
        WHERE id = 'submission-1'
      `).run(timestamp);
    });
    await assert.rejects(
      applyLogjamAdminMutation(archivedFixture.d1, {
        action: "promote-submission",
        submissionId: "submission-1"
      }),
      (error) => error instanceof LogjamAdminError && error.code === "submission_archived"
    );
    assert.equal(
      scalarNumber(archivedFixture.sqlite, "SELECT COUNT(*) AS value FROM archive_albums"),
      0
    );
  } finally {
    archivedFixture.sqlite.close();
  }

  const photoFixture = createFixture();
  try {
    photoFixture.adapter.beforeNextBatch(() => {
      photoFixture.sqlite.prepare("UPDATE archive_photos SET status = 'review' WHERE id = 'photo-2'")
        .run();
    });
    await assert.rejects(
      applyLogjamAdminMutation(photoFixture.d1, {
        action: "promote-submission",
        submissionId: "submission-1"
      }),
      (error) => error instanceof LogjamAdminError && error.code === "source_photos_unavailable"
    );
    assert.equal(
      scalarNumber(photoFixture.sqlite, "SELECT COUNT(*) AS value FROM archive_albums"),
      0
    );
  } finally {
    photoFixture.sqlite.close();
  }
});

test("D1 triggers enforce per-curation and per-user snapshot caps", () => {
  const curationFixture = createFixture();
  try {
    for (let version = 2; version <= 20; version += 1) {
      seedSubmission(curationFixture.sqlite, {
        id: `submission-cap-${version}`,
        version,
        sourceRevision: version,
        photoId: "photo-1"
      });
    }
    assert.throws(() => seedSubmission(curationFixture.sqlite, {
      id: "submission-cap-21",
      version: 21,
      sourceRevision: 21,
      photoId: "photo-1"
    }), /storage limit/);
  } finally {
    curationFixture.sqlite.close();
  }

  const userFixture = createFixture();
  try {
    for (const curationId of ["curation-2", "curation-3", "curation-4"]) {
      userFixture.sqlite.prepare(`
        INSERT INTO logjam_curations (
          id, user_id, title, status, revision, created_at, updated_at
        ) VALUES (?, 'user-1', ?, 'active', 1, ?, ?)
      `).run(curationId, curationId, timestamp, timestamp);
    }
    for (let version = 1; version <= 20; version += 1) {
      seedSubmission(userFixture.sqlite, {
        id: `submission-user-c2-${version}`,
        curationId: "curation-2",
        version,
        sourceRevision: version,
        photoId: "photo-1"
      });
      seedSubmission(userFixture.sqlite, {
        id: `submission-user-c3-${version}`,
        curationId: "curation-3",
        version,
        sourceRevision: version,
        photoId: "photo-1"
      });
    }
    for (let version = 1; version <= 9; version += 1) {
      seedSubmission(userFixture.sqlite, {
        id: `submission-user-c4-${version}`,
        curationId: "curation-4",
        version,
        sourceRevision: version,
        photoId: "photo-1"
      });
    }
    assert.equal(
      scalarNumber(userFixture.sqlite, `
        SELECT COUNT(*) AS value
        FROM logjam_submissions submission
        JOIN logjam_curations curation ON curation.id = submission.curation_id
        WHERE curation.user_id = 'user-1'
      `),
      50
    );
    assert.throws(() => seedSubmission(userFixture.sqlite, {
      id: "submission-user-51",
      curationId: "curation-4",
      version: 10,
      sourceRevision: 10,
      photoId: "photo-1"
    }), /storage limit/);
  } finally {
    userFixture.sqlite.close();
  }
});

function createFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of [
    "0001_archive.sql",
    "0002_album_photo_order.sql",
    "0003_upload_job_photo.sql",
    "0004_cloud_admin.sql",
    "0005_public_web_tiers.sql",
    "0006_logjam.sql"
  ]) {
    sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  }

  sqlite.prepare(`
    INSERT INTO logjam_users (
      id, access_sub, email_normalized, owner_display_name, created_at, updated_at, last_seen_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?), (?, ?, ?, NULL, ?, ?, ?)
  `).run(
    "user-1", "access-user-1", "friend@example.com", timestamp, timestamp, timestamp,
    "user-2", "access-user-2", "curator@example.com", timestamp, timestamp, timestamp
  );

  for (const photo of [
    { id: "photo-1", status: "published", title: "Frame one" },
    { id: "photo-2", status: "published", title: "Frame two" },
    { id: "photo-3", status: "review", title: "Frame three" }
  ]) {
    sqlite.prepare(`
      INSERT INTO archive_photos (
        id, slug, title, description, status, width, height, dominant_color, created_at, updated_at
      ) VALUES (?, ?, ?, '', ?, 2000, 1333, '#111111', ?, ?)
    `).run(photo.id, photo.id, photo.title, photo.status, timestamp, timestamp);
    for (const version of ["thumb", "display"] as const) {
      sqlite.prepare(`
        INSERT INTO archive_assets (
          id, photo_id, version, access, bucket, object_key, public_url,
          width, height, bytes, mime_type, color_profile, created_at
        ) VALUES (?, ?, ?, 'public', 'yakov-public-assets', ?, ?, 1000, 667, 1000,
          'image/jpeg', 'srgb', ?)
      `).run(
        `asset-${photo.id}-${version}`,
        photo.id,
        version,
        `${version}/${photo.id}.jpg`,
        `https://assets.yakov.shmol.cc/${version}/${photo.id}.jpg`,
        timestamp
      );
    }
  }

  sqlite.prepare(`
    INSERT INTO logjam_curations (id, user_id, title, status, revision, created_at, updated_at)
    VALUES ('curation-1', 'user-1', 'First selection', 'active', 1, ?, ?)
  `).run(timestamp, timestamp);
  sqlite.prepare(`
    INSERT INTO logjam_curation_items (curation_id, photo_id, position, created_at)
    VALUES ('curation-1', 'photo-1', 0, ?), ('curation-1', 'photo-2', 1, ?)
  `).run(timestamp, timestamp);
  sqlite.prepare(`
    INSERT INTO logjam_submissions (
      id, curation_id, version, source_revision, title, item_count, status, submitted_at
    ) VALUES ('submission-1', 'curation-1', 1, 1, 'First selection', 2, 'submitted', ?)
  `).run(timestamp);
  sqlite.prepare(`
    INSERT INTO logjam_submission_items (submission_id, photo_id, position, created_at)
    VALUES ('submission-1', 'photo-1', 0, ?), ('submission-1', 'photo-2', 1, ?)
  `).run(timestamp, timestamp);
  sqlite.prepare("UPDATE logjam_submissions SET sealed_at = ? WHERE id = ?")
    .run(timestamp, "submission-1");

  const adapter = new SqliteD1Database(sqlite);
  return {
    sqlite,
    adapter,
    d1: adapter as unknown as D1Database
  };
}

function seedSubmission(
  sqlite: DatabaseSync,
  input: {
    id: string;
    curationId?: string;
    version: number;
    sourceRevision: number;
    photoId: string;
  }
) {
  const curationId = input.curationId ?? "curation-1";
  sqlite.prepare(`
    INSERT INTO logjam_submissions (
      id, curation_id, version, source_revision, title, item_count, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, 1, 'submitted', ?)
  `).run(input.id, curationId, input.version, input.sourceRevision, input.id, timestamp);
  sqlite.prepare(`
    INSERT INTO logjam_submission_items (submission_id, photo_id, position, created_at)
    VALUES (?, ?, 0, ?)
  `).run(input.id, input.photoId, timestamp);
  sqlite.prepare("UPDATE logjam_submissions SET sealed_at = ? WHERE id = ?")
    .run(timestamp, input.id);
}

function scalarNumber(sqlite: DatabaseSync, sql: string, ...values: SQLInputValue[]) {
  const row = sqlite.prepare(sql).get(...values);
  return Number(row?.value ?? 0);
}

class SqliteD1Database {
  private beforeBatch: (() => void) | undefined;

  constructor(private readonly sqlite: DatabaseSync) {}

  beforeNextBatch(callback: () => void) {
    this.beforeBatch = callback;
  }

  prepare(sql: string) {
    return new SqliteD1Statement(this.sqlite, sql) as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]) {
    const beforeBatch = this.beforeBatch;
    this.beforeBatch = undefined;
    beforeBatch?.();
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) =>
        (statement as unknown as SqliteD1Statement).execute()
      );
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

class SqliteD1Statement {
  constructor(
    private readonly sqlite: DatabaseSync,
    private readonly sql: string,
    private readonly values: SQLInputValue[] = []
  ) {}

  bind(...values: unknown[]) {
    return new SqliteD1Statement(
      this.sqlite,
      this.sql,
      values.map(toSqliteValue)
    ) as unknown as D1PreparedStatement;
  }

  async first<T>(columnName?: string): Promise<T | null> {
    const row = this.sqlite.prepare(this.sql).get(...this.values);
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  async all<T>() {
    const results = this.sqlite.prepare(this.sql).all(...this.values) as T[];
    return d1Result(results);
  }

  async run<T>() {
    const result = this.sqlite.prepare(this.sql).run(...this.values);
    return d1Result<T>([], Number(result.changes));
  }

  execute() {
    const statement = this.sqlite.prepare(this.sql);
    if (statement.columns().length) {
      return d1Result(statement.all(...this.values));
    }
    const result = statement.run(...this.values);
    return d1Result([], Number(result.changes));
  }
}

function d1Result<T>(results: T[], changes = 0) {
  return {
    success: true,
    results,
    meta: { changes }
  } as unknown as D1Result<T>;
}

function toSqliteValue(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  throw new TypeError(`Unsupported SQLite test bind value: ${typeof value}`);
}
