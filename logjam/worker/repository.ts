import type {
  AccountPhoto,
  AccountPayload,
  AlbumDecisionProgress,
  AlbumDetail,
  AlbumSummary,
  CurationDetail,
  CurationSummary,
  DecisionDeletionRecord,
  DecisionRecord,
  DecisionValue,
  PublicPhoto,
  Viewer
} from "../shared/contracts";
import {
  MAX_CURATIONS_PER_USER,
  MAX_SUBMISSIONS_PER_CURATION,
  MAX_SUBMISSIONS_PER_USER
} from "../shared/logic";
import type { AppUser } from "./env";
import { HttpError } from "./http";

type AlbumRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  cover_url: string | null;
  photo_count: number;
  photo_order_direction?: "forward" | "reverse";
  sort_order?: number;
  created_at?: string;
};

type PhotoRow = {
  id: string;
  slug: string;
  title: string;
  width: number;
  height: number;
  thumb_url: string | null;
  display_url: string | null;
};

type AccountPhotoRow = PhotoRow & {
  source_album_title: string;
};

type AlbumDecisionProgressRow = {
  album_id: string;
  kept_count: number;
  passed_count: number;
  total_count: number;
};

type CurationRow = {
  id: string;
  title: string;
  status: "active" | "archived";
  revision: number;
  item_count: number;
  submission_count: number;
  locked: number;
  updated_at: string;
};

const publicPhotoColumns = `
  p.id,
  p.slug,
  p.title,
  p.width,
  p.height,
  (
    SELECT aa.public_url
    FROM archive_assets aa
    WHERE aa.photo_id = p.id
      AND aa.version = 'thumb'
      AND aa.access = 'public'
      AND aa.public_url IS NOT NULL
    ORDER BY aa.created_at DESC
    LIMIT 1
  ) AS thumb_url,
  (
    SELECT aa.public_url
    FROM archive_assets aa
    WHERE aa.photo_id = p.id
      AND aa.version = 'display'
      AND aa.access = 'public'
      AND aa.public_url IS NOT NULL
    ORDER BY aa.created_at DESC
    LIMIT 1
  ) AS display_url
`;

const curationColumns = `
  c.id,
  c.title,
  c.status,
  c.revision,
  c.updated_at,
  (SELECT COUNT(*) FROM logjam_curation_items ci WHERE ci.curation_id = c.id) AS item_count,
  (
    SELECT COUNT(*)
    FROM logjam_submissions ls
    WHERE ls.curation_id = c.id AND ls.sealed_at IS NOT NULL
  ) AS submission_count,
  EXISTS (
    SELECT 1
    FROM logjam_submissions ls
    WHERE ls.curation_id = c.id AND ls.source_locked_at IS NOT NULL
  ) AS locked
`;

export async function listPublicAlbums(db: D1Database): Promise<AlbumSummary[]> {
  const result = await db.prepare(`
    SELECT
      a.id,
      a.slug,
      a.title,
      a.subtitle,
      COALESCE(
        (
          SELECT thumb.public_url
          FROM archive_assets selected
          JOIN archive_assets thumb ON thumb.photo_id = selected.photo_id
          JOIN archive_photos cover_photo ON cover_photo.id = selected.photo_id
          WHERE selected.id = CASE a.cover_priority
            WHEN 'portrait' THEN COALESCE(a.cover_portrait_asset_id, a.cover_landscape_asset_id, a.cover_square_asset_id)
            WHEN 'square' THEN COALESCE(a.cover_square_asset_id, a.cover_landscape_asset_id, a.cover_portrait_asset_id)
            ELSE COALESCE(a.cover_landscape_asset_id, a.cover_square_asset_id, a.cover_portrait_asset_id)
          END
            AND cover_photo.status = 'published'
            AND thumb.version = 'thumb'
            AND thumb.access = 'public'
            AND thumb.public_url IS NOT NULL
          ORDER BY thumb.created_at DESC
          LIMIT 1
        ),
        (
          SELECT fallback_asset.public_url
          FROM album_photos fallback_ap
          JOIN archive_photos fallback_photo ON fallback_photo.id = fallback_ap.photo_id
          JOIN archive_assets fallback_asset ON fallback_asset.photo_id = fallback_photo.id
          WHERE fallback_ap.album_id = a.id
            AND fallback_photo.status = 'published'
            AND fallback_asset.version = 'thumb'
            AND fallback_asset.access = 'public'
            AND fallback_asset.public_url IS NOT NULL
          ORDER BY fallback_ap.position, fallback_photo.id, fallback_asset.created_at DESC, fallback_asset.id
          LIMIT 1
        )
      ) AS cover_url,
      (
        SELECT COUNT(*)
        FROM album_photos count_ap
        JOIN archive_photos count_photo ON count_photo.id = count_ap.photo_id
        WHERE count_ap.album_id = a.id
          AND count_photo.status = 'published'
          AND EXISTS (
            SELECT 1 FROM archive_assets display_asset
            WHERE display_asset.photo_id = count_photo.id
              AND display_asset.version = 'display'
              AND display_asset.access = 'public'
              AND display_asset.public_url IS NOT NULL
          )
          AND EXISTS (
            SELECT 1 FROM archive_assets thumb_asset
            WHERE thumb_asset.photo_id = count_photo.id
              AND thumb_asset.version = 'thumb'
              AND thumb_asset.access = 'public'
              AND thumb_asset.public_url IS NOT NULL
          )
      ) AS photo_count
    FROM archive_albums a
    WHERE a.status = 'published'
    ORDER BY a.sort_order, a.created_at, a.id
  `).all<AlbumRow>();
  return rows<AlbumRow>(result).map(mapAlbum);
}

export async function listAlbumDecisionProgress(
  db: D1Database,
  userId: string
): Promise<AlbumDecisionProgress[]> {
  const result = await db.prepare(`
    SELECT
      a.id AS album_id,
      COUNT(*) AS total_count,
      SUM(CASE WHEN d.decision = 'keep' THEN 1 ELSE 0 END) AS kept_count,
      SUM(CASE WHEN d.decision = 'pass' THEN 1 ELSE 0 END) AS passed_count
    FROM archive_albums a
    JOIN album_photos ap ON ap.album_id = a.id
    JOIN archive_photos p ON p.id = ap.photo_id
    LEFT JOIN logjam_decisions d
      ON d.user_id = ?
      AND d.photo_id = p.id
    WHERE a.status = 'published'
      AND p.status = 'published'
      AND EXISTS (
        SELECT 1 FROM archive_assets display_asset
        WHERE display_asset.photo_id = p.id
          AND display_asset.version = 'display'
          AND display_asset.access = 'public'
          AND display_asset.public_url IS NOT NULL
      )
      AND EXISTS (
        SELECT 1 FROM archive_assets thumb_asset
        WHERE thumb_asset.photo_id = p.id
          AND thumb_asset.version = 'thumb'
          AND thumb_asset.access = 'public'
          AND thumb_asset.public_url IS NOT NULL
      )
    GROUP BY a.id
    ORDER BY a.sort_order, a.created_at, a.id
  `).bind(userId).all<AlbumDecisionProgressRow>();

  return rows<AlbumDecisionProgressRow>(result).map((row) => ({
    albumId: row.album_id,
    keptCount: Number(row.kept_count),
    passedCount: Number(row.passed_count),
    totalCount: Number(row.total_count)
  }));
}

export async function readPublicAlbum(db: D1Database, slug: string): Promise<AlbumDetail> {
  const album = await db.prepare(`
    SELECT
      a.id,
      a.slug,
      a.title,
      a.subtitle,
      a.photo_order_direction,
      a.sort_order,
      a.created_at,
      '' AS cover_url,
      (
        SELECT COUNT(*) FROM album_photos ap
        JOIN archive_photos p ON p.id = ap.photo_id
        WHERE ap.album_id = a.id AND p.status = 'published'
      ) AS photo_count
    FROM archive_albums a
    WHERE a.slug = ? AND a.status = 'published'
  `).bind(slug).first<AlbumRow>();
  if (!album) throw new HttpError(404, "album_not_found", "Album not found.");

  const [photoResult, nextAlbum] = await Promise.all([
    db.prepare(`
      SELECT ${publicPhotoColumns}, ap.position
      FROM album_photos ap
      JOIN archive_photos p ON p.id = ap.photo_id
      WHERE ap.album_id = ? AND p.status = 'published'
      ORDER BY ap.position, p.id
    `).bind(album.id).all<PhotoRow & { position: number }>(),
    db.prepare(`
      SELECT slug
      FROM archive_albums
      WHERE status = 'published'
        AND (
          sort_order > ? OR
          (sort_order = ? AND created_at > ?) OR
          (sort_order = ? AND created_at = ? AND id > ?)
        )
      ORDER BY sort_order, created_at, id
      LIMIT 1
    `).bind(
      album.sort_order,
      album.sort_order,
      album.created_at,
      album.sort_order,
      album.created_at,
      album.id
    ).first<{ slug: string }>()
  ]);

  const photoRows = rows<PhotoRow & { position: number }>(photoResult);
  if (album.photo_order_direction === "reverse") photoRows.reverse();
  const photos = photoRows.flatMap((photo) => {
    const mapped = mapPhoto(photo);
    return mapped ? [mapped] : [];
  });
  return {
    ...mapAlbum({ ...album, photo_count: photos.length }),
    photos,
    nextAlbumSlug: nextAlbum?.slug ?? null
  };
}

export async function isPublishedPhoto(db: D1Database, photoId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT p.id
    FROM archive_photos p
    WHERE p.id = ?
      AND p.status = 'published'
      AND EXISTS (
        SELECT 1 FROM album_photos ap
        JOIN archive_albums a ON a.id = ap.album_id
        WHERE ap.photo_id = p.id AND a.status = 'published'
      )
      AND EXISTS (
        SELECT 1 FROM archive_assets aa
        WHERE aa.photo_id = p.id
          AND aa.version = 'display'
          AND aa.access = 'public'
          AND aa.public_url IS NOT NULL
      )
  `).bind(photoId).first<{ id: string }>();
  return Boolean(row);
}

export async function putDecision(
  db: D1Database,
  userId: string,
  photoId: string,
  decision: DecisionValue
): Promise<DecisionRecord> {
  if (!(await isPublishedPhoto(db, photoId))) {
    throw new HttpError(404, "photo_not_found", "Published photo not found.");
  }
  const now = new Date().toISOString();
  const updatedAt = decisionUpdatedAt(now);
  const writeDecision = db.prepare(`
    INSERT INTO logjam_decisions (user_id, photo_id, decision, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, photo_id) DO UPDATE SET
      decision = excluded.decision,
      updated_at = excluded.updated_at
  `).bind(userId, photoId, decision, now, updatedAt);

  if (decision === "pass") {
    await db.batch([
      writeDecision,
      ...pruneMutableCurationStatements(db, userId, photoId, now)
    ]);
  } else {
    await writeDecision.run();
  }
  return { photoId, decision, updatedAt };
}

export async function deleteDecision(
  db: D1Database,
  userId: string,
  photoId: string
): Promise<DecisionDeletionRecord> {
  const now = new Date().toISOString();
  const results = await db.batch([
    ...pruneMutableCurationStatements(db, userId, photoId, now),
    db.prepare(`
      DELETE FROM logjam_decisions
      WHERE user_id = ? AND photo_id = ?
    `).bind(userId, photoId)
  ]);
  return {
    photoId,
    deleted: (results.at(-1)?.meta.changes ?? 0) === 1
  };
}

export async function undoDecision(
  db: D1Database,
  userId: string,
  photoId: string,
  expectedUpdatedAt: string,
  previousDecision: DecisionValue | null
): Promise<DecisionRecord | null> {
  const now = new Date().toISOString();
  const updatedAt = decisionUpdatedAt(now);
  const reconcile = previousDecision === "keep"
    ? []
    : pruneMutableCurationStatements(db, userId, photoId, now, expectedUpdatedAt);
  const restore = previousDecision === null
    ? db.prepare(`
        DELETE FROM logjam_decisions
        WHERE user_id = ? AND photo_id = ? AND updated_at = ?
      `).bind(userId, photoId, expectedUpdatedAt)
    : db.prepare(`
        UPDATE logjam_decisions
        SET decision = ?, updated_at = ?
        WHERE user_id = ? AND photo_id = ? AND updated_at = ?
      `).bind(previousDecision, updatedAt, userId, photoId, expectedUpdatedAt);

  // D1 batches execute sequentially in a single transaction. Every reconciliation
  // statement carries the same compare guard, so a stale undo is a complete no-op.
  const results = await db.batch([...reconcile, restore]);
  if ((results.at(-1)?.meta.changes ?? 0) !== 1) {
    throw new HttpError(
      409,
      "decision_conflict",
      "The decision changed in another tab. Reload and try again."
    );
  }

  return previousDecision === null
    ? null
    : { photoId, decision: previousDecision, updatedAt };
}

function pruneMutableCurationStatements(
  db: D1Database,
  userId: string,
  photoId: string,
  now: string,
  expectedUpdatedAt?: string
): D1PreparedStatement[] {
  const expected = expectedUpdatedAt ?? null;
  return [
    db.prepare(`
      UPDATE logjam_curations
      SET revision = revision + 1, updated_at = ?
      WHERE user_id = ?
        AND status = 'active'
        AND EXISTS (
          SELECT 1 FROM logjam_decisions existing_decision
          WHERE existing_decision.user_id = ? AND existing_decision.photo_id = ?
            AND (? IS NULL OR existing_decision.updated_at = ?)
        )
        AND EXISTS (
          SELECT 1 FROM logjam_curation_items item
          WHERE item.curation_id = logjam_curations.id AND item.photo_id = ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM logjam_submissions lock_submission
          WHERE lock_submission.curation_id = logjam_curations.id
            AND lock_submission.source_locked_at IS NOT NULL
        )
    `).bind(now, userId, userId, photoId, expected, expected, photoId),
    db.prepare(`
      DELETE FROM logjam_curation_items
      WHERE photo_id = ?
        AND EXISTS (
          SELECT 1 FROM logjam_decisions existing_decision
          WHERE existing_decision.user_id = ? AND existing_decision.photo_id = ?
            AND (? IS NULL OR existing_decision.updated_at = ?)
        )
        AND curation_id IN (
          SELECT c.id
          FROM logjam_curations c
          WHERE c.user_id = ?
            AND c.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM logjam_submissions lock_submission
              WHERE lock_submission.curation_id = c.id
                AND lock_submission.source_locked_at IS NOT NULL
            )
        )
    `).bind(photoId, userId, photoId, expected, expected, userId)
  ];
}

function decisionUpdatedAt(now: string): string {
  // The timestamp prefix keeps account ordering useful; the UUID makes this an
  // unambiguous compare token even when separate Worker requests share a millisecond.
  return `${now}~${crypto.randomUUID()}`;
}

export async function readAccount(db: D1Database, user: AppUser): Promise<AccountPayload> {
  const [decisionResult, keptResult, passedResult, curationResult] = await db.batch([
    db.prepare(`
      SELECT d.photo_id, d.decision, d.updated_at
      FROM logjam_decisions d
      JOIN archive_photos p ON p.id = d.photo_id
      WHERE d.user_id = ?
        AND p.status = 'published'
        AND EXISTS (
          SELECT 1 FROM album_photos ap
          JOIN archive_albums a ON a.id = ap.album_id
          WHERE ap.photo_id = p.id AND a.status = 'published'
        )
      ORDER BY d.updated_at DESC
    `).bind(user.id),
    decisionPhotosStatement(db, user.id, "keep"),
    decisionPhotosStatement(db, user.id, "pass"),
    db.prepare(`
      SELECT ${curationColumns}
      FROM logjam_curations c
      WHERE c.user_id = ?
      ORDER BY c.status = 'archived', c.updated_at DESC
    `).bind(user.id)
  ]);

  return {
    viewer: viewerFromUser(user),
    decisions: rows(decisionResult).map((row) => {
      const value = row as { photo_id: string; decision: DecisionValue; updated_at: string };
      return { photoId: value.photo_id, decision: value.decision, updatedAt: value.updated_at };
    }),
    keptPhotos: rows<AccountPhotoRow>(keptResult).flatMap((row) => mapAccountPhoto(row) ?? []),
    passedPhotos: rows<AccountPhotoRow>(passedResult).flatMap((row) => mapAccountPhoto(row) ?? []),
    curations: rows<CurationRow>(curationResult).map(mapCuration)
  };
}

export async function createCuration(
  db: D1Database,
  userId: string,
  title: string
): Promise<CurationSummary> {
  const id = `cur_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const result = await db.prepare(`
    INSERT INTO logjam_curations (
      id, user_id, title, status, revision, created_at, updated_at
    )
    SELECT ?, ?, ?, 'active', 1, ?, ?
    WHERE (SELECT COUNT(*) FROM logjam_curations WHERE user_id = ?) < ?
  `).bind(id, userId, title, now, now, userId, MAX_CURATIONS_PER_USER).run();
  if ((result.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, "curation_limit", `You can have up to ${MAX_CURATIONS_PER_USER} curations.`);
  }
  return readCurationSummary(db, userId, id);
}

export async function readCuration(
  db: D1Database,
  userId: string,
  curationId: string
): Promise<CurationDetail> {
  const summary = await readCurationSummary(db, userId, curationId);
  const [photoResult, submissionResult] = await db.batch([
    db.prepare(`
      SELECT ${publicPhotoColumns}, ci.position
      FROM logjam_curation_items ci
      JOIN logjam_curations owner_curation
        ON owner_curation.id = ci.curation_id
        AND owner_curation.user_id = ?
      JOIN archive_photos p ON p.id = ci.photo_id
      LEFT JOIN logjam_decisions current_decision
        ON current_decision.user_id = owner_curation.user_id
        AND current_decision.photo_id = ci.photo_id
      WHERE ci.curation_id = ?
        AND p.status = 'published'
        AND (
          current_decision.decision = 'keep'
          OR owner_curation.status = 'archived'
          OR EXISTS (
            SELECT 1 FROM logjam_submissions lock_submission
            WHERE lock_submission.curation_id = owner_curation.id
              AND lock_submission.source_locked_at IS NOT NULL
          )
        )
        AND EXISTS (
          SELECT 1 FROM album_photos ap
          JOIN archive_albums a ON a.id = ap.album_id
          WHERE ap.photo_id = p.id AND a.status = 'published'
        )
      ORDER BY ci.position
    `).bind(userId, curationId),
    db.prepare(`
      SELECT
        s.id,
        s.version,
        s.status,
        s.submitted_at,
        s.promoted_album_id,
        s.item_count
      FROM logjam_submissions s
      WHERE s.curation_id = ? AND s.sealed_at IS NOT NULL
      ORDER BY s.version DESC
    `).bind(curationId)
  ]);
  return {
    ...summary,
    photos: rows<PhotoRow>(photoResult).flatMap((row) => mapPhoto(row) ?? []),
    submissions: rows(submissionResult).map((raw) => {
      const row = raw as {
        id: string;
        version: number;
        status: "submitted" | "archived";
        submitted_at: string;
        promoted_album_id: string | null;
        item_count: number;
      };
      return {
        id: row.id,
        version: Number(row.version),
        status: row.status,
        submittedAt: row.submitted_at,
        promotedAlbumId: row.promoted_album_id,
        itemCount: Number(row.item_count)
      };
    })
  };
}

export async function updateCuration(
  db: D1Database,
  userId: string,
  curationId: string,
  input: { title?: string; photoIds?: string[] }
): Promise<CurationDetail> {
  const current = await requireEditableCuration(db, userId, curationId);
  if (input.photoIds) await requireKeptPublishedPhotos(db, userId, input.photoIds);
  const title = input.title ?? current.title;
  const now = new Date().toISOString();
  const photoIdsJson = input.photoIds ? JSON.stringify(input.photoIds) : null;
  const requestedPhotosStillValid = input.photoIds ? `
    AND (
      SELECT COUNT(*)
      FROM json_each(?) requested
      JOIN logjam_decisions d
        ON d.user_id = ? AND d.photo_id = CAST(requested.value AS TEXT) AND d.decision = 'keep'
      JOIN archive_photos p ON p.id = d.photo_id AND p.status = 'published'
      WHERE EXISTS (
        SELECT 1 FROM album_photos ap
        JOIN archive_albums a ON a.id = ap.album_id
        WHERE ap.photo_id = p.id AND a.status = 'published'
      )
        AND EXISTS (
          SELECT 1 FROM archive_assets display_asset
          WHERE display_asset.photo_id = p.id
            AND display_asset.version = 'display'
            AND display_asset.access = 'public'
            AND display_asset.public_url IS NOT NULL
        )
        AND EXISTS (
          SELECT 1 FROM archive_assets thumb_asset
          WHERE thumb_asset.photo_id = p.id
            AND thumb_asset.version = 'thumb'
            AND thumb_asset.access = 'public'
            AND thumb_asset.public_url IS NOT NULL
        )
    ) = json_array_length(?)
  ` : "";
  const statements: D1PreparedStatement[] = [];
  if (input.photoIds) {
    statements.push(
      db.prepare(`
        DELETE FROM logjam_curation_items
        WHERE curation_id = ?
          AND EXISTS (
            SELECT 1 FROM logjam_curations c
            WHERE c.id = ? AND c.user_id = ? AND c.status = 'active' AND c.revision = ?
              AND NOT EXISTS (
                SELECT 1 FROM logjam_submissions lock_submission
                WHERE lock_submission.curation_id = c.id
                  AND lock_submission.source_locked_at IS NOT NULL
              )
              ${requestedPhotosStillValid}
          )
      `).bind(
        curationId,
        curationId,
        userId,
        current.revision,
        photoIdsJson,
        userId,
        photoIdsJson
      ),
      db.prepare(`
        INSERT INTO logjam_curation_items (curation_id, photo_id, position, created_at)
        SELECT c.id, CAST(requested.value AS TEXT), CAST(requested.key AS INTEGER), ?
        FROM logjam_curations c, json_each(?) requested
        WHERE c.id = ? AND c.user_id = ? AND c.status = 'active' AND c.revision = ?
          AND NOT EXISTS (
            SELECT 1 FROM logjam_submissions lock_submission
            WHERE lock_submission.curation_id = c.id
              AND lock_submission.source_locked_at IS NOT NULL
          )
          ${requestedPhotosStillValid}
      `).bind(
        now,
        photoIdsJson,
        curationId,
        userId,
        current.revision,
        photoIdsJson,
        userId,
        photoIdsJson
      )
    );
  }
  const updateStatement = db.prepare(`
    UPDATE logjam_curations
    SET title = ?, revision = revision + 1, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'active' AND revision = ?
      AND NOT EXISTS (
        SELECT 1 FROM logjam_submissions lock_submission
        WHERE lock_submission.curation_id = logjam_curations.id
          AND lock_submission.source_locked_at IS NOT NULL
      )
      ${requestedPhotosStillValid}
  `);
  statements.push(input.photoIds
    ? updateStatement.bind(
      title,
      now,
      curationId,
      userId,
      current.revision,
      photoIdsJson,
      userId,
      photoIdsJson
    )
    : updateStatement.bind(title, now, curationId, userId, current.revision));
  const results = await db.batch(statements);
  if ((results.at(-1)?.meta.changes ?? 0) !== 1) {
    const latest = await requireEditableCuration(db, userId, curationId);
    if (Number(latest.revision) !== Number(current.revision)) {
      throw new HttpError(409, "curation_changed", "The draft changed in another request. Reload and try again.");
    }
    throw new HttpError(409, "curation_conflict", "The draft could not be updated. Reload and try again.");
  }
  return readCuration(db, userId, curationId);
}

export async function archiveCuration(
  db: D1Database,
  userId: string,
  curationId: string
): Promise<void> {
  const current = await requireEditableCuration(db, userId, curationId);
  const result = await db.prepare(`
    UPDATE logjam_curations
    SET status = 'archived', revision = revision + 1, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'active' AND revision = ?
      AND NOT EXISTS (
        SELECT 1 FROM logjam_submissions lock_submission
        WHERE lock_submission.curation_id = logjam_curations.id
          AND lock_submission.source_locked_at IS NOT NULL
      )
  `).bind(new Date().toISOString(), curationId, userId, current.revision).run();
  if ((result.meta.changes ?? 0) !== 1) {
    const latest = await requireEditableCuration(db, userId, curationId);
    if (Number(latest.revision) !== Number(current.revision)) {
      throw new HttpError(409, "curation_changed", "The draft changed in another request. Reload and try again.");
    }
    throw new HttpError(409, "curation_conflict", "The curation could not be archived. Reload and try again.");
  }
}

export async function submitCuration(
  db: D1Database,
  userId: string,
  curationId: string
): Promise<{ id: string; version: number; submittedAt: string }> {
  const current = await requireEditableCuration(db, userId, curationId);
  const currentPhotoIds = await readOrderedCurationPhotoIds(db, curationId);
  const itemCount = currentPhotoIds.length;
  if (itemCount < 1) {
    throw new HttpError(409, "empty_curation", "Add at least one kept photo before submitting.");
  }
  await requireKeptPublishedPhotos(db, userId, currentPhotoIds);

  const existing = await db.prepare(`
    SELECT id, version, submitted_at
    FROM logjam_submissions
    WHERE curation_id = ? AND source_revision = ? AND sealed_at IS NOT NULL
  `).bind(curationId, current.revision).first<{
    id: string;
    version: number;
    submitted_at: string;
  }>();
  if (existing) {
    await requireMatchingSnapshotMembership(db, existing.id, currentPhotoIds);
    return { id: existing.id, version: Number(existing.version), submittedAt: existing.submitted_at };
  }

  await requireSubmissionCapacity(db, userId, curationId);
  const versionRow = await db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 AS version
    FROM logjam_submissions
    WHERE curation_id = ?
  `).bind(curationId).first<{ version: number }>();
  const version = Number(versionRow?.version ?? 1);
  const id = `sub_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    const batchResults = await db.batch([
      db.prepare(`
        INSERT INTO logjam_submissions (
          id, curation_id, version, source_revision, title, item_count, status, submitted_at
        )
        SELECT
          ?,
          c.id,
          ?,
          c.revision,
          c.title,
          (SELECT COUNT(*) FROM logjam_curation_items WHERE curation_id = c.id),
          'submitted',
          ?
        FROM logjam_curations c
        WHERE c.id = ?
          AND c.user_id = ?
          AND c.status = 'active'
          AND c.revision = ?
          AND NOT EXISTS (
            SELECT 1
            FROM logjam_submissions lock_submission
            WHERE lock_submission.curation_id = c.id
              AND lock_submission.source_locked_at IS NOT NULL
          )
          AND (
            SELECT json_group_array(ordered.photo_id)
            FROM (
              SELECT ci.photo_id
              FROM logjam_curation_items ci
              WHERE ci.curation_id = c.id
              ORDER BY ci.position, ci.photo_id
            ) ordered
          ) = ?
          AND (
            SELECT COUNT(*)
            FROM logjam_submissions existing_submission
            WHERE existing_submission.curation_id = c.id
          ) < ?
          AND (
            SELECT COUNT(*)
            FROM logjam_submissions existing_submission
            JOIN logjam_curations existing_curation
              ON existing_curation.id = existing_submission.curation_id
            WHERE existing_curation.user_id = c.user_id
          ) < ?
          AND (
            SELECT COUNT(*) FROM logjam_curation_items WHERE curation_id = c.id
          ) > 0
          AND (
            SELECT COUNT(*) FROM logjam_curation_items WHERE curation_id = c.id
          ) = (
            SELECT COUNT(*)
            FROM logjam_curation_items ci
            JOIN logjam_decisions d
              ON d.user_id = ? AND d.photo_id = ci.photo_id AND d.decision = 'keep'
            JOIN archive_photos p ON p.id = ci.photo_id AND p.status = 'published'
            WHERE ci.curation_id = c.id
              AND EXISTS (
                SELECT 1 FROM album_photos ap
                JOIN archive_albums a ON a.id = ap.album_id
                WHERE ap.photo_id = p.id AND a.status = 'published'
              )
              AND EXISTS (
                SELECT 1 FROM archive_assets display_asset
                WHERE display_asset.photo_id = p.id
                  AND display_asset.version = 'display'
                  AND display_asset.access = 'public'
                  AND display_asset.public_url IS NOT NULL
              )
              AND EXISTS (
                SELECT 1 FROM archive_assets thumb_asset
                WHERE thumb_asset.photo_id = p.id
                  AND thumb_asset.version = 'thumb'
                  AND thumb_asset.access = 'public'
                  AND thumb_asset.public_url IS NOT NULL
              )
          )
      `).bind(
        id,
        version,
        now,
        curationId,
        userId,
        current.revision,
        JSON.stringify(currentPhotoIds),
        MAX_SUBMISSIONS_PER_CURATION,
        MAX_SUBMISSIONS_PER_USER,
        userId
      ),
      db.prepare(`
        INSERT INTO logjam_submission_items (submission_id, photo_id, position, created_at)
        SELECT ?, photo_id, position, ?
        FROM logjam_curation_items
        WHERE curation_id = ?
        ORDER BY position, photo_id
      `).bind(id, now, curationId),
      db.prepare(`
        UPDATE logjam_submissions
        SET sealed_at = ?
        WHERE id = ? AND sealed_at IS NULL
      `).bind(now, id)
    ]);
    if (
      (batchResults[0]?.meta.changes ?? 0) !== 1 ||
      (batchResults[2]?.meta.changes ?? 0) !== 1
    ) {
      throw new HttpError(409, "curation_changed", "The draft changed while submitting. Review it and try again.");
    }
  } catch (error) {
    const raced = await db.prepare(`
      SELECT id, version, submitted_at
      FROM logjam_submissions
      WHERE curation_id = ? AND source_revision = ? AND sealed_at IS NOT NULL
    `).bind(curationId, current.revision).first<{
      id: string;
      version: number;
      submitted_at: string;
    }>();
    if (raced) {
      await requireMatchingSnapshotMembership(db, raced.id, currentPhotoIds);
      return { id: raced.id, version: Number(raced.version), submittedAt: raced.submitted_at };
    }
    const latest = await requireEditableCuration(db, userId, curationId);
    if (Number(latest.revision) !== Number(current.revision)) {
      throw new HttpError(409, "curation_changed", "The draft changed while submitting. Review it and try again.");
    }
    const latestPhotoIds = await readOrderedCurationPhotoIds(db, curationId);
    if (
      latestPhotoIds.length !== currentPhotoIds.length ||
      latestPhotoIds.some((photoId, index) => photoId !== currentPhotoIds[index])
    ) {
      throw new HttpError(409, "curation_changed", "The draft changed while submitting. Review it and try again.");
    }
    await requireKeptPublishedPhotos(db, userId, latestPhotoIds);
    await requireSubmissionCapacity(db, userId, curationId);
    console.error("LogJam snapshot batch conflict", error instanceof Error ? error.message : "unknown error");
    throw new HttpError(409, "snapshot_conflict", "The snapshot could not be sealed. Try again.");
  }
  return { id, version, submittedAt: now };
}

async function readOrderedCurationPhotoIds(db: D1Database, curationId: string) {
  const result = await db.prepare(`
    SELECT photo_id
    FROM logjam_curation_items
    WHERE curation_id = ?
    ORDER BY position, photo_id
  `).bind(curationId).all<{ photo_id: string }>();
  return rows<{ photo_id: string }>(result).map((row) => row.photo_id);
}

async function requireMatchingSnapshotMembership(
  db: D1Database,
  submissionId: string,
  currentPhotoIds: string[]
) {
  const result = await db.prepare(`
    SELECT photo_id
    FROM logjam_submission_items
    WHERE submission_id = ?
    ORDER BY position, photo_id
  `).bind(submissionId).all<{ photo_id: string }>();
  const submittedPhotoIds = rows<{ photo_id: string }>(result).map((row) => row.photo_id);
  if (
    submittedPhotoIds.length !== currentPhotoIds.length ||
    submittedPhotoIds.some((photoId, index) => photoId !== currentPhotoIds[index])
  ) {
    throw new HttpError(
      409,
      "curation_changed",
      "The draft membership changed outside this revision. Save it again before submitting."
    );
  }
}

async function requireSubmissionCapacity(
  db: D1Database,
  userId: string,
  curationId: string
) {
  const row = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM logjam_submissions WHERE curation_id = ?) AS curation_count,
      (
        SELECT COUNT(*)
        FROM logjam_submissions submission
        JOIN logjam_curations curation ON curation.id = submission.curation_id
        WHERE curation.user_id = ?
      ) AS user_count
  `).bind(curationId, userId).first<{ curation_count: number; user_count: number }>();
  if (
    Number(row?.curation_count ?? 0) >= MAX_SUBMISSIONS_PER_CURATION ||
    Number(row?.user_count ?? 0) >= MAX_SUBMISSIONS_PER_USER
  ) {
    throw new HttpError(
      409,
      "submission_limit",
      `Snapshot limit reached (${MAX_SUBMISSIONS_PER_CURATION} per curation, ${MAX_SUBMISSIONS_PER_USER} per account).`
    );
  }
}

async function readCurationSummary(
  db: D1Database,
  userId: string,
  curationId: string
): Promise<CurationSummary> {
  const row = await db.prepare(`
    SELECT ${curationColumns}
    FROM logjam_curations c
    WHERE c.id = ? AND c.user_id = ?
  `).bind(curationId, userId).first<CurationRow>();
  if (!row) throw new HttpError(404, "curation_not_found", "Curation not found.");
  return mapCuration(row);
}

async function requireEditableCuration(
  db: D1Database,
  userId: string,
  curationId: string
): Promise<CurationRow> {
  const row = await db.prepare(`
    SELECT ${curationColumns}
    FROM logjam_curations c
    WHERE c.id = ? AND c.user_id = ?
  `).bind(curationId, userId).first<CurationRow>();
  if (!row) throw new HttpError(404, "curation_not_found", "Curation not found.");
  if (row.status !== "active") throw new HttpError(409, "curation_archived", "Archived curations cannot be edited.");
  if (Number(row.locked) === 1) {
    throw new HttpError(409, "curation_locked", "This curation is locked because its promoted album has been published.");
  }
  return row;
}

async function requireKeptPublishedPhotos(
  db: D1Database,
  userId: string,
  photoIds: string[]
): Promise<void> {
  if (photoIds.length === 0) return;
  const row = await db.prepare(`
    WITH requested AS (
      SELECT CAST(value AS TEXT) AS photo_id FROM json_each(?)
    )
    SELECT COUNT(*) AS valid_count
    FROM requested r
    JOIN logjam_decisions d
      ON d.user_id = ? AND d.photo_id = r.photo_id AND d.decision = 'keep'
    JOIN archive_photos p ON p.id = r.photo_id AND p.status = 'published'
    WHERE EXISTS (
      SELECT 1 FROM album_photos ap
      JOIN archive_albums a ON a.id = ap.album_id
      WHERE ap.photo_id = p.id AND a.status = 'published'
    )
      AND EXISTS (
        SELECT 1 FROM archive_assets display_asset
        WHERE display_asset.photo_id = p.id
          AND display_asset.version = 'display'
          AND display_asset.access = 'public'
          AND display_asset.public_url IS NOT NULL
      )
      AND EXISTS (
        SELECT 1 FROM archive_assets thumb_asset
        WHERE thumb_asset.photo_id = p.id
          AND thumb_asset.version = 'thumb'
          AND thumb_asset.access = 'public'
          AND thumb_asset.public_url IS NOT NULL
      )
  `).bind(JSON.stringify(photoIds), userId).first<{ valid_count: number }>();
  if (Number(row?.valid_count ?? 0) !== photoIds.length) {
    throw new HttpError(400, "invalid_curation_photos", "A curation may contain only your kept, published photos.");
  }
}

function decisionPhotosStatement(db: D1Database, userId: string, decision: DecisionValue) {
  return db.prepare(`
    SELECT
      ${publicPhotoColumns},
      d.updated_at,
      (
        SELECT GROUP_CONCAT(source_album.title, ' · ')
        FROM (
          SELECT a.title
          FROM album_photos ap
          JOIN archive_albums a ON a.id = ap.album_id
          WHERE ap.photo_id = p.id AND a.status = 'published'
          ORDER BY a.sort_order, a.created_at, a.id
        ) source_album
      ) AS source_album_title
    FROM logjam_decisions d
    JOIN archive_photos p ON p.id = d.photo_id
    WHERE d.user_id = ?
      AND d.decision = ?
      AND p.status = 'published'
      AND EXISTS (
        SELECT 1 FROM album_photos ap
        JOIN archive_albums a ON a.id = ap.album_id
        WHERE ap.photo_id = p.id AND a.status = 'published'
      )
    ORDER BY d.updated_at DESC
  `).bind(userId, decision);
}

function mapAlbum(row: AlbumRow): AlbumSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    coverUrl: row.cover_url ?? "",
    photoCount: Number(row.photo_count)
  };
}

function mapPhoto(row: PhotoRow): PublicPhoto | null {
  if (!row.thumb_url || !row.display_url) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    width: Number(row.width),
    height: Number(row.height),
    thumbUrl: row.thumb_url,
    displayUrl: row.display_url
  };
}

function mapAccountPhoto(row: AccountPhotoRow): AccountPhoto | null {
  const photo = mapPhoto(row);
  if (!photo) return null;
  return {
    ...photo,
    sourceAlbumTitle: row.source_album_title
  };
}

function mapCuration(row: CurationRow): CurationSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    revision: Number(row.revision),
    itemCount: Number(row.item_count),
    submissionCount: Number(row.submission_count),
    locked: Number(row.locked) === 1,
    updatedAt: row.updated_at
  };
}

function viewerFromUser(user: AppUser): Viewer {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

function rows<T = Record<string, unknown>>(result: { results?: unknown[] }): T[] {
  return (result.results ?? []) as T[];
}
