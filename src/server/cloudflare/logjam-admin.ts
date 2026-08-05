import type { ArchiveStatus } from "@/admin/archive-schema";
import type { LogjamAdminMutation } from "@/server/cloudflare/logjam-admin-contract";

type Database = CloudflareEnv["DB"];
type CurationStatus = "active" | "archived";
type SubmissionStatus = "submitted" | "archived";

type UserRow = {
  id: string;
  email_normalized: string;
  owner_display_name: string | null;
  created_at: string;
  last_seen_at: string | null;
};

type InviteRow = {
  email_normalized: string;
  invited_at: string;
  joined_at: string | null;
};

type CurationRow = {
  id: string;
  user_id: string;
  title: string;
  status: CurationStatus;
  revision: number;
  photo_count: number;
  created_at: string;
  updated_at: string;
  locked: number;
};

type SubmissionRow = {
  id: string;
  curation_id: string;
  version: number;
  source_revision: number;
  title: string;
  status: SubmissionStatus;
  photo_count: number;
  submitted_at: string;
  archived_at: string | null;
  promoted_album_id: string | null;
  promoted_album_status: ArchiveStatus | null;
  promoted_at: string | null;
};

type SubmissionDetailRow = SubmissionRow & {
  user_id: string;
  user_email: string;
  user_display_name: string | null;
};

type SnapshotPhotoRow = {
  photo_id: string;
  position: number;
  title: string | null;
  status: ArchiveStatus | null;
  width: number | null;
  height: number | null;
  thumb_url: string | null;
  display_url: string | null;
};

type PromotionSnapshotRow = {
  photo_id: string;
  position: number;
};

type PromotedAlbumRow = {
  id: string;
  slug: string;
  status: ArchiveStatus;
};

export async function readLogjamAdminOverview(db: Database) {
  const [inviteResult, userResult, curationResult, submissionResult] = await db.batch([
    db.prepare(`
      SELECT
        invitation.email_normalized,
        invitation.invited_at,
        user.created_at AS joined_at
      FROM logjam_invites invitation
      LEFT JOIN logjam_users user
        ON user.email_normalized = invitation.email_normalized
      ORDER BY invitation.email_normalized COLLATE NOCASE
    `),
    db.prepare(`
      SELECT id, email_normalized, owner_display_name, created_at, last_seen_at
      FROM logjam_users
      ORDER BY COALESCE(owner_display_name, email_normalized) COLLATE NOCASE, created_at
    `),
    db.prepare(`
      SELECT
        c.id,
        c.user_id,
        c.title,
        c.status,
        c.revision,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT item.photo_id) AS photo_count,
        CASE WHEN EXISTS (
          SELECT 1
          FROM logjam_submissions locked_submission
          WHERE locked_submission.curation_id = c.id
            AND locked_submission.source_locked_at IS NOT NULL
        ) THEN 1 ELSE 0 END AS locked
      FROM logjam_curations c
      LEFT JOIN logjam_curation_items item ON item.curation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC, c.created_at DESC
    `),
    db.prepare(`
      SELECT
        s.id,
        s.curation_id,
        s.version,
        s.source_revision,
        s.title,
        s.status,
        s.submitted_at,
        s.archived_at,
        s.promoted_album_id,
        s.promoted_at,
        promoted.status AS promoted_album_status,
        s.item_count AS photo_count
      FROM logjam_submissions s
      LEFT JOIN archive_albums promoted ON promoted.id = s.promoted_album_id
      WHERE s.sealed_at IS NOT NULL
      ORDER BY s.curation_id, s.version DESC
    `)
  ]);

  const submissionsByCuration = groupBy(
    resultRows<SubmissionRow>(submissionResult),
    (submission) => submission.curation_id
  );

  return {
    invites: resultRows<InviteRow>(inviteResult).map((invite) => ({
      email: invite.email_normalized,
      invitedAt: invite.invited_at,
      joinedAt: invite.joined_at
    })),
    users: resultRows<UserRow>(userResult).map(mapUser),
    curations: resultRows<CurationRow>(curationResult).map((curation) => ({
      id: curation.id,
      userId: curation.user_id,
      title: curation.title,
      status: curation.status,
      revision: curation.revision,
      photoCount: curation.photo_count,
      locked: Boolean(curation.locked),
      createdAt: curation.created_at,
      updatedAt: curation.updated_at,
      submissions: (submissionsByCuration.get(curation.id) ?? []).map(mapSubmission)
    }))
  };
}

export async function readLogjamAdminSubmission(db: Database, submissionId: string) {
  const submission = await db.prepare(`
    SELECT
      s.id,
      s.curation_id,
      s.version,
      s.source_revision,
      s.title,
      s.status,
      s.submitted_at,
      s.archived_at,
      s.promoted_album_id,
      s.promoted_at,
      promoted.status AS promoted_album_status,
      c.user_id,
      u.email_normalized AS user_email,
      u.owner_display_name AS user_display_name,
      s.item_count AS photo_count
    FROM logjam_submissions s
    JOIN logjam_curations c ON c.id = s.curation_id
    JOIN logjam_users u ON u.id = c.user_id
    LEFT JOIN archive_albums promoted ON promoted.id = s.promoted_album_id
    WHERE s.id = ? AND s.sealed_at IS NOT NULL
  `).bind(submissionId).first<SubmissionDetailRow>();

  if (!submission) throw notFound("submission");

  const photoResult = await db.prepare(`
    SELECT
      item.photo_id,
      item.position,
      photo.title,
      photo.status,
      photo.width,
      photo.height,
      (
        SELECT asset.public_url
        FROM archive_assets asset
        WHERE asset.photo_id = item.photo_id
          AND asset.access = 'public'
          AND asset.version = 'thumb'
          AND asset.public_url IS NOT NULL
        ORDER BY asset.created_at DESC, asset.id
        LIMIT 1
      ) AS thumb_url,
      (
        SELECT asset.public_url
        FROM archive_assets asset
        WHERE asset.photo_id = item.photo_id
          AND asset.access = 'public'
          AND asset.version = 'display'
          AND asset.public_url IS NOT NULL
        ORDER BY asset.created_at DESC, asset.id
        LIMIT 1
      ) AS display_url
    FROM logjam_submission_items item
    LEFT JOIN archive_photos photo ON photo.id = item.photo_id
    WHERE item.submission_id = ?
    ORDER BY item.position, item.photo_id
  `).bind(submissionId).all<SnapshotPhotoRow>();

  return {
    submission: {
      ...mapSubmission(submission),
      curationId: submission.curation_id,
      userId: submission.user_id,
      userEmail: submission.user_email,
      userDisplayName: submission.user_display_name
    },
    photos: resultRows<SnapshotPhotoRow>(photoResult).map((photo) => ({
      id: photo.photo_id,
      position: photo.position,
      title: photo.title,
      thumbUrl: photo.thumb_url,
      displayUrl: photo.display_url,
      width: photo.width,
      height: photo.height,
      available: photo.title !== null,
      published: photo.status === "published"
    }))
  };
}

export async function applyLogjamAdminMutation(
  db: Database,
  mutation: LogjamAdminMutation
) {
  switch (mutation.action) {
    case "invite-email":
      return inviteEmail(db, mutation.email);
    case "revoke-invite":
      return revokeInvite(db, mutation.email);
    case "rename-user":
      return renameUser(db, mutation.userId, mutation.displayName);
    case "archive-submission":
      return archiveSubmission(db, mutation.submissionId);
    case "promote-submission":
      return promoteSubmission(db, mutation.submissionId, mutation.title);
  }
}

const protectedOwnerEmail = "jacobjshmol@gmail.com";

async function inviteEmail(db: Database, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const timestamp = now();
  const result = await db.prepare(`
    INSERT INTO logjam_invites (email_normalized, invited_at, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(email_normalized) DO NOTHING
  `).bind(normalizedEmail, timestamp, timestamp).run();
  const invitation = await db.prepare(`
    SELECT email_normalized, invited_at
    FROM logjam_invites
    WHERE email_normalized = ?
  `).bind(normalizedEmail).first<{ email_normalized: string; invited_at: string }>();
  if (!invitation) {
    throw new LogjamAdminError(
      "invitation_create_failed",
      "The LogJam invitation could not be created.",
      500
    );
  }
  return {
    email: invitation.email_normalized,
    invitedAt: invitation.invited_at,
    created: (result.meta.changes ?? 0) === 1
  };
}

async function revokeInvite(db: Database, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === protectedOwnerEmail) {
    throw new LogjamAdminError(
      "owner_invitation_protected",
      "The owner email must retain LogJam access.",
      409
    );
  }
  const result = await db.prepare(`
    DELETE FROM logjam_invites WHERE email_normalized = ?
  `).bind(normalizedEmail).run();
  return { email: normalizedEmail, revoked: (result.meta.changes ?? 0) === 1 };
}

async function renameUser(db: Database, userId: string, displayName: string | null) {
  const user = await db.prepare("SELECT id FROM logjam_users WHERE id = ?")
    .bind(userId)
    .first<{ id: string }>();
  if (!user) throw notFound("user");

  const timestamp = now();
  await db.prepare(`
    UPDATE logjam_users SET owner_display_name = ?, updated_at = ? WHERE id = ?
  `).bind(displayName, timestamp, userId).run();
  return { userId, displayName };
}

async function archiveSubmission(db: Database, submissionId: string) {
  const submission = await db.prepare(`
    SELECT id, status, archived_at
    FROM logjam_submissions
    WHERE id = ? AND sealed_at IS NOT NULL
  `).bind(submissionId).first<{
    id: string;
    status: SubmissionStatus;
    archived_at: string | null;
  }>();
  if (!submission) throw notFound("submission");

  if (submission.status === "archived") {
    return {
      submissionId,
      status: "archived" as const,
      archivedAt: submission.archived_at as string
    };
  }

  const archivedAt = now();
  const result = await db.prepare(`
    UPDATE logjam_submissions
    SET status = 'archived', archived_at = ?
    WHERE id = ? AND status = 'submitted' AND sealed_at IS NOT NULL
  `).bind(archivedAt, submissionId).run();
  if ((result.meta.changes ?? 0) === 1) {
    return { submissionId, status: "archived" as const, archivedAt };
  }

  const raced = await db.prepare(`
    SELECT status, archived_at
    FROM logjam_submissions
    WHERE id = ? AND sealed_at IS NOT NULL
  `).bind(submissionId).first<{ status: SubmissionStatus; archived_at: string | null }>();
  if (raced?.status === "archived" && raced.archived_at) {
    return {
      submissionId,
      status: "archived" as const,
      archivedAt: raced.archived_at
    };
  }
  throw new LogjamAdminError(
    "submission_archive_conflict",
    "The submission changed while it was being archived.",
    409
  );
}

async function promoteSubmission(db: Database, submissionId: string, requestedTitle?: string) {
  const submission = await db.prepare(`
    SELECT id, title, status, promoted_album_id
    FROM logjam_submissions
    WHERE id = ? AND sealed_at IS NOT NULL
  `).bind(submissionId).first<{
    id: string;
    title: string;
    status: SubmissionStatus;
    promoted_album_id: string | null;
  }>();
  if (!submission) throw notFound("submission");
  if (submission.status === "archived") {
    throw new LogjamAdminError(
      "submission_archived",
      "An archived submission cannot be promoted.",
      409
    );
  }

  if (submission.promoted_album_id) {
    return readPromotionResult(db, submissionId, submission.promoted_album_id, false);
  }

  const snapshotResult = await db.prepare(`
    SELECT photo_id, position
    FROM logjam_submission_items
    WHERE submission_id = ?
    ORDER BY position, photo_id
  `).bind(submissionId).all<PromotionSnapshotRow>();
  const snapshot = resultRows<PromotionSnapshotRow>(snapshotResult);
  if (!snapshot.length) {
    throw new LogjamAdminError("empty_submission", "An empty submission cannot be promoted.", 409);
  }

  const unavailablePhotoIds = await readUnavailablePromotionPhotoIds(db, submissionId);
  if (unavailablePhotoIds.length) {
    throw new LogjamAdminError(
      "source_photos_unavailable",
      "Every submitted photo must still exist and be published before promotion.",
      409,
      { photoIds: unavailablePhotoIds }
    );
  }

  const title = requestedTitle ?? submission.title;
  const identity = await promotionIdentity(submissionId);
  const albumId = `album-logjam-${identity}`;
  const idCollision = await db.prepare("SELECT id FROM archive_albums WHERE id = ?")
    .bind(albumId)
    .first<{ id: string }>();
  if (idCollision) {
    const raced = await db.prepare(`
      SELECT promoted_album_id FROM logjam_submissions WHERE id = ?
    `).bind(submissionId).first<{ promoted_album_id: string | null }>();
    if (raced?.promoted_album_id === albumId) {
      return readPromotionResult(db, submissionId, albumId, false);
    }
    throw new LogjamAdminError(
      "promotion_id_conflict",
      "The deterministic promotion album ID is already in use.",
      409
    );
  }

  const slug = await uniquePromotionSlug(db, title, identity);
  const firstPhotoId = snapshot[0].photo_id;
  const [cover, order] = await Promise.all([
    db.prepare(`
      SELECT
        MAX(CASE WHEN version = 'display' AND access = 'public' THEN id END) AS display_id,
        MAX(CASE WHEN version = 'thumb' AND access = 'public' THEN id END) AS thumb_id
      FROM archive_assets
      WHERE photo_id = ?
    `).bind(firstPhotoId).first<{ display_id: string | null; thumb_id: string | null }>(),
    db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM archive_albums")
      .first<{ value: number }>()
  ]);
  const timestamp = now();

  let batchResults: D1Result[];
  try {
    batchResults = await db.batch([
      db.prepare(`
        INSERT INTO archive_albums (
          id, slug, title, subtitle, description, status, is_demo,
          public_download_policy, cover_landscape_asset_id, cover_portrait_asset_id,
          cover_square_asset_id, cover_priority, sort_order, photo_order_direction,
          created_at, updated_at
        )
        SELECT
          ?, ?, ?, '', '', 'draft', 0, 'none', ?, ?, ?, 'landscape', ?, 'forward', ?, ?
        FROM logjam_submissions eligible
        WHERE eligible.id = ?
          AND eligible.status = 'submitted'
          AND eligible.sealed_at IS NOT NULL
          AND eligible.promoted_album_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM logjam_submission_items item
            WHERE item.submission_id = eligible.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM logjam_submission_items item
            LEFT JOIN archive_photos photo ON photo.id = item.photo_id
            WHERE item.submission_id = eligible.id
              AND (
                photo.id IS NULL
                OR photo.status != 'published'
                OR NOT EXISTS (
                  SELECT 1 FROM archive_assets thumb_asset
                  WHERE thumb_asset.photo_id = item.photo_id
                    AND thumb_asset.version = 'thumb'
                    AND thumb_asset.access = 'public'
                    AND thumb_asset.public_url IS NOT NULL
                )
                OR NOT EXISTS (
                  SELECT 1 FROM archive_assets display_asset
                  WHERE display_asset.photo_id = item.photo_id
                    AND display_asset.version = 'display'
                    AND display_asset.access = 'public'
                    AND display_asset.public_url IS NOT NULL
                )
              )
          )
      `).bind(
        albumId,
        slug,
        title,
        cover?.display_id ?? null,
        cover?.display_id ?? null,
        cover?.thumb_id ?? cover?.display_id ?? null,
        order?.value ?? 0,
        timestamp,
        timestamp,
        submissionId
      ),
      db.prepare(`
        INSERT INTO album_photos (album_id, photo_id, position, created_at)
        SELECT
          ?,
          item.photo_id,
          ROW_NUMBER() OVER (ORDER BY item.position, item.photo_id),
          ?
        FROM logjam_submission_items item
        JOIN logjam_submissions eligible
          ON eligible.id = item.submission_id
          AND eligible.status = 'submitted'
          AND eligible.sealed_at IS NOT NULL
          AND eligible.promoted_album_id IS NULL
        JOIN archive_albums created_album
          ON created_album.id = ?
          AND created_album.created_at = ?
        WHERE item.submission_id = ?
      `).bind(albumId, timestamp, albumId, timestamp, submissionId),
      db.prepare(`
        UPDATE logjam_submissions
        SET promoted_album_id = ?, promoted_at = ?
        WHERE id = ?
          AND status = 'submitted'
          AND sealed_at IS NOT NULL
          AND promoted_album_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM archive_albums created_album
            WHERE created_album.id = ? AND created_album.created_at = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM logjam_submission_items item
            LEFT JOIN archive_photos photo ON photo.id = item.photo_id
            WHERE item.submission_id = logjam_submissions.id
              AND (
                photo.id IS NULL
                OR photo.status != 'published'
                OR NOT EXISTS (
                  SELECT 1 FROM archive_assets thumb_asset
                  WHERE thumb_asset.photo_id = item.photo_id
                    AND thumb_asset.version = 'thumb'
                    AND thumb_asset.access = 'public'
                    AND thumb_asset.public_url IS NOT NULL
                )
                OR NOT EXISTS (
                  SELECT 1 FROM archive_assets display_asset
                  WHERE display_asset.photo_id = item.photo_id
                    AND display_asset.version = 'display'
                    AND display_asset.access = 'public'
                    AND display_asset.public_url IS NOT NULL
                )
              )
          )
      `).bind(albumId, timestamp, submissionId, albumId, timestamp),
      db.prepare(`
        INSERT INTO archive_albums (
          id, slug, title, status, is_demo, public_download_policy,
          sort_order, created_at, updated_at
        )
        SELECT
          guard_album.id,
          guard_album.slug,
          guard_album.title,
          guard_album.status,
          guard_album.is_demo,
          guard_album.public_download_policy,
          guard_album.sort_order,
          guard_album.created_at,
          guard_album.updated_at
        FROM archive_albums guard_album
        WHERE guard_album.id = ?
          AND NOT EXISTS (
            SELECT 1
            FROM logjam_submissions linked_submission
            WHERE linked_submission.id = ?
              AND linked_submission.promoted_album_id = guard_album.id
          )
      `).bind(albumId, submissionId)
    ]);
  } catch (error) {
    const raced = await db.prepare(`
      SELECT promoted_album_id FROM logjam_submissions WHERE id = ?
    `).bind(submissionId).first<{ promoted_album_id: string | null }>();
    if (raced?.promoted_album_id) {
      return readPromotionResult(db, submissionId, raced.promoted_album_id, false);
    }
    throw error;
  }

  const albumChanges = batchResults[0]?.meta.changes ?? 0;
  const membershipChanges = batchResults[1]?.meta.changes ?? 0;
  const linkChanges = batchResults[2]?.meta.changes ?? 0;
  if (
    albumChanges === 1 &&
    membershipChanges === snapshot.length &&
    linkChanges === 1
  ) {
    return readPromotionResult(db, submissionId, albumId, true);
  }

  const raced = await db.prepare(`
    SELECT status, promoted_album_id
    FROM logjam_submissions
    WHERE id = ? AND sealed_at IS NOT NULL
  `).bind(submissionId).first<{
    status: SubmissionStatus;
    promoted_album_id: string | null;
  }>();
  if (!raced) throw notFound("submission");
  if (raced.promoted_album_id) {
    return readPromotionResult(db, submissionId, raced.promoted_album_id, false);
  }
  if (raced.status === "archived") {
    throw new LogjamAdminError(
      "submission_archived",
      "An archived submission cannot be promoted.",
      409
    );
  }
  const racedUnavailablePhotoIds = await readUnavailablePromotionPhotoIds(db, submissionId);
  if (racedUnavailablePhotoIds.length) {
    throw new LogjamAdminError(
      "source_photos_unavailable",
      "Every submitted photo must still exist and be published before promotion.",
      409,
      { photoIds: racedUnavailablePhotoIds }
    );
  }
  throw new LogjamAdminError(
    "promotion_conflict",
    "The submission changed while it was being promoted.",
    409
  );

}

async function readUnavailablePromotionPhotoIds(db: Database, submissionId: string) {
  const result = await db.prepare(`
    SELECT item.photo_id
    FROM logjam_submission_items item
    LEFT JOIN archive_photos photo ON photo.id = item.photo_id
    WHERE item.submission_id = ?
      AND (
        photo.id IS NULL
        OR photo.status != 'published'
        OR NOT EXISTS (
          SELECT 1 FROM archive_assets thumb_asset
          WHERE thumb_asset.photo_id = item.photo_id
            AND thumb_asset.version = 'thumb'
            AND thumb_asset.access = 'public'
            AND thumb_asset.public_url IS NOT NULL
        )
        OR NOT EXISTS (
          SELECT 1 FROM archive_assets display_asset
          WHERE display_asset.photo_id = item.photo_id
            AND display_asset.version = 'display'
            AND display_asset.access = 'public'
            AND display_asset.public_url IS NOT NULL
        )
      )
    ORDER BY item.position, item.photo_id
  `).bind(submissionId).all<{ photo_id: string }>();
  return resultRows<{ photo_id: string }>(result).map((photo) => photo.photo_id);
}

async function readPromotionResult(
  db: Database,
  submissionId: string,
  albumId: string,
  created: boolean
) {
  const album = await db.prepare(`
    SELECT id, slug, status FROM archive_albums WHERE id = ?
  `).bind(albumId).first<PromotedAlbumRow>();
  if (!album) {
    throw new LogjamAdminError(
      "promotion_target_missing",
      "This submission was already promoted, but its canonical album no longer exists.",
      409
    );
  }
  return {
    submissionId,
    albumId: album.id,
    albumSlug: album.slug,
    albumStatus: album.status,
    created
  };
}

async function promotionIdentity(submissionId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(submissionId)
  );
  return Array.from(new Uint8Array(digest).slice(0, 10), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function uniquePromotionSlug(db: Database, title: string, identity: string) {
  const titleSlug = slugify(title).slice(0, 80) || "selection";
  const base = `${titleSlug}-logjam-${identity.slice(0, 8)}`;
  const existing = await db.prepare("SELECT id FROM archive_albums WHERE slug = ?")
    .bind(base)
    .first<{ id: string }>();
  return existing ? `${base}-${identity.slice(8, 12)}` : base;
}

function mapUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email_normalized,
    displayName: user.owner_display_name,
    createdAt: user.created_at,
    ...(user.last_seen_at ? { lastSeenAt: user.last_seen_at } : {})
  };
}

function mapSubmission(submission: SubmissionRow) {
  return {
    id: submission.id,
    version: submission.version,
    sourceRevision: submission.source_revision,
    title: submission.title,
    status: submission.status,
    photoCount: submission.photo_count,
    submittedAt: submission.submitted_at,
    ...(submission.archived_at ? { archivedAt: submission.archived_at } : {}),
    ...(submission.promoted_album_id
      ? { promotedAlbumId: submission.promoted_album_id }
      : {}),
    ...(submission.promoted_album_status
      ? { promotedAlbumStatus: submission.promoted_album_status }
      : {}),
    ...(submission.promoted_at ? { promotedAt: submission.promoted_at } : {})
  };
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function groupBy<T>(values: T[], key: (value: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const itemKey = key(value);
    grouped.set(itemKey, [...(grouped.get(itemKey) ?? []), value]);
  }
  return grouped;
}

function resultRows<T>(result: { results?: unknown[] }): T[] {
  return (result.results ?? []) as T[];
}

function now() {
  return new Date().toISOString();
}

function notFound(entity: string) {
  return new LogjamAdminError("not_found", `LogJam ${entity} was not found.`, 404);
}

export class LogjamAdminError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
  }
}
