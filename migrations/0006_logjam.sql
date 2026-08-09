-- Durable LogJam collaboration state and immutable submission snapshots.
-- Media remains canonical in archive_photos/archive_assets; LogJam never copies R2 objects.

CREATE TABLE IF NOT EXISTS logjam_users (
  id TEXT PRIMARY KEY,
  access_sub TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL COLLATE NOCASE UNIQUE,
  owner_display_name TEXT
    CHECK (
      owner_display_name IS NULL OR
      (length(trim(owner_display_name)) BETWEEN 1 AND 120)
    ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT
);

-- Decisions are intentionally global per user/photo, not scoped to an album.
CREATE TABLE IF NOT EXISTS logjam_decisions (
  user_id TEXT NOT NULL REFERENCES logjam_users(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES archive_photos(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('keep', 'pass')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, photo_id)
);

CREATE TABLE IF NOT EXISTS logjam_curations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES logjam_users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logjam_curation_items (
  curation_id TEXT NOT NULL REFERENCES logjam_curations(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES archive_photos(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (curation_id, photo_id),
  UNIQUE (curation_id, position)
);

CREATE TABLE IF NOT EXISTS logjam_submissions (
  id TEXT PRIMARY KEY,
  curation_id TEXT NOT NULL REFERENCES logjam_curations(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 0),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'archived')),
  submitted_at TEXT NOT NULL,
  sealed_at TEXT,
  archived_at TEXT,
  -- Deliberately not a foreign key: deleting an archive album must not erase the
  -- idempotency record and allow the same submission to be promoted twice.
  promoted_album_id TEXT UNIQUE,
  promoted_at TEXT,
  -- Durable first-publication marker. It intentionally survives deletion of the
  -- canonical album so a curator workspace can never become editable again.
  source_locked_at TEXT,
  UNIQUE (curation_id, version),
  UNIQUE (curation_id, source_revision),
  CHECK (
    (status = 'submitted' AND archived_at IS NULL) OR
    (status = 'archived' AND archived_at IS NOT NULL AND sealed_at IS NOT NULL)
  ),
  CHECK (
    (promoted_album_id IS NULL AND promoted_at IS NULL) OR
    (promoted_album_id IS NOT NULL AND promoted_at IS NOT NULL AND sealed_at IS NOT NULL)
  ),
  CHECK (
    source_locked_at IS NULL OR
    (promoted_album_id IS NOT NULL AND promoted_at IS NOT NULL AND sealed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS logjam_submission_items (
  submission_id TEXT NOT NULL REFERENCES logjam_submissions(id) ON DELETE RESTRICT,
  -- Deliberately not a foreign key: an immutable snapshot retains the canonical
  -- photo ID even if the source photo is later purged. Promotion validates it anew.
  photo_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (submission_id, photo_id),
  UNIQUE (submission_id, position)
);

CREATE INDEX IF NOT EXISTS idx_logjam_decisions_photo
  ON logjam_decisions(photo_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_logjam_curations_user
  ON logjam_curations(user_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_logjam_curation_items_order
  ON logjam_curation_items(curation_id, position);
CREATE INDEX IF NOT EXISTS idx_logjam_submissions_curation
  ON logjam_submissions(curation_id, version);
CREATE INDEX IF NOT EXISTS idx_logjam_submissions_status
  ON logjam_submissions(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_logjam_submission_items_order
  ON logjam_submission_items(submission_id, position);
CREATE INDEX IF NOT EXISTS idx_logjam_submission_items_photo
  ON logjam_submission_items(photo_id);

-- Snapshot identity and membership never change. Administrative lifecycle fields
-- (status, archived_at, promoted_album_id, promoted_at) remain mutable. The
-- first-publication lock is filled once by archive-album triggers below.
CREATE TRIGGER IF NOT EXISTS logjam_submission_insert_unsealed
BEFORE INSERT ON logjam_submissions
WHEN NEW.sealed_at IS NOT NULL OR NEW.source_locked_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'LogJam submissions must be assembled before sealing or locking');
END;

-- These are durable storage quotas, not merely application prechecks. Archived
-- snapshots count toward both limits because snapshots are intentionally retained.
CREATE TRIGGER IF NOT EXISTS logjam_submission_storage_limit
BEFORE INSERT ON logjam_submissions
WHEN
  (SELECT COUNT(*) FROM logjam_submissions WHERE curation_id = NEW.curation_id) >= 20
  OR
  (
    SELECT COUNT(*)
    FROM logjam_submissions existing_submission
    JOIN logjam_curations existing_curation
      ON existing_curation.id = existing_submission.curation_id
    WHERE existing_curation.user_id = (
      SELECT owner_curation.user_id
      FROM logjam_curations owner_curation
      WHERE owner_curation.id = NEW.curation_id
    )
  ) >= 50
BEGIN
  SELECT RAISE(ABORT, 'LogJam submission storage limit exceeded');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_snapshot_immutable
BEFORE UPDATE OF curation_id, version, source_revision, title, item_count, submitted_at
ON logjam_submissions
BEGIN
  SELECT RAISE(ABORT, 'LogJam submission snapshots are immutable');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_seal_validate
BEFORE UPDATE OF sealed_at ON logjam_submissions
WHEN
  OLD.sealed_at IS NOT NULL
  OR NEW.sealed_at IS NULL
  OR OLD.item_count != (
    SELECT COUNT(*)
    FROM logjam_submission_items item
    WHERE item.submission_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'LogJam submission snapshot cannot be sealed');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_lifecycle_requires_seal
BEFORE UPDATE OF status, archived_at, promoted_album_id, promoted_at, source_locked_at
ON logjam_submissions
WHEN OLD.sealed_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'LogJam submission must be sealed before lifecycle changes');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_source_lock_irreversible
BEFORE UPDATE OF source_locked_at ON logjam_submissions
WHEN OLD.source_locked_at IS NOT NULL OR NEW.source_locked_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'LogJam publication lock is irreversible');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_no_delete
BEFORE DELETE ON logjam_submissions
BEGIN
  SELECT RAISE(ABORT, 'LogJam submissions cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_items_no_update
BEFORE UPDATE ON logjam_submission_items
BEGIN
  SELECT RAISE(ABORT, 'LogJam submission items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_items_no_late_insert
BEFORE INSERT ON logjam_submission_items
WHEN EXISTS (
  SELECT 1
  FROM logjam_submissions submission
  WHERE submission.id = NEW.submission_id
    AND submission.sealed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'LogJam submission items cannot be added after sealing');
END;

CREATE TRIGGER IF NOT EXISTS logjam_submission_items_no_delete
BEFORE DELETE ON logjam_submission_items
BEGIN
  SELECT RAISE(ABORT, 'LogJam submission items cannot be deleted');
END;

-- Canonical photo purge cascades mutable curation membership. Bump the revision
-- before the cascade so a concurrent Submit cannot seal a silently smaller list.
CREATE TRIGGER IF NOT EXISTS logjam_photo_delete_bump_curation_revisions
BEFORE DELETE ON archive_photos
BEGIN
  UPDATE logjam_curations
  SET
    revision = revision + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id IN (
    SELECT curation_id
    FROM logjam_curation_items
    WHERE photo_id = OLD.id
  );
END;

-- Lock the curator source at the first canonical publication. The marker lives on
-- the immutable LogJam record, so hiding or physically deleting the Album cannot
-- reopen the user's working curation.
CREATE TRIGGER IF NOT EXISTS logjam_lock_source_after_album_insert
AFTER INSERT ON archive_albums
WHEN NEW.status = 'published'
BEGIN
  UPDATE logjam_submissions
  SET source_locked_at = COALESCE(NEW.published_at, NEW.updated_at, NEW.created_at)
  WHERE promoted_album_id = NEW.id
    AND sealed_at IS NOT NULL
    AND source_locked_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS logjam_lock_source_after_album_publish
AFTER UPDATE OF status, published_at ON archive_albums
WHEN NEW.status = 'published'
BEGIN
  UPDATE logjam_submissions
  SET source_locked_at = COALESCE(NEW.published_at, NEW.updated_at, NEW.created_at)
  WHERE promoted_album_id = NEW.id
    AND sealed_at IS NOT NULL
    AND source_locked_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS logjam_lock_source_after_promotion_link
AFTER UPDATE OF promoted_album_id ON logjam_submissions
WHEN NEW.promoted_album_id IS NOT NULL AND NEW.source_locked_at IS NULL
BEGIN
  UPDATE logjam_submissions
  SET source_locked_at = (
    SELECT COALESCE(album.published_at, album.updated_at, album.created_at)
    FROM archive_albums album
    WHERE album.id = NEW.promoted_album_id
      AND (album.published_at IS NOT NULL OR album.status = 'published')
  )
  WHERE id = NEW.id
    AND sealed_at IS NOT NULL
    AND source_locked_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM archive_albums album
      WHERE album.id = NEW.promoted_album_id
        AND (album.published_at IS NOT NULL OR album.status = 'published')
    );
END;

-- Makes the migration safe if it is applied over an interrupted preview that
-- already linked a LogJam submission to a canonical published album.
UPDATE logjam_submissions
SET source_locked_at = (
  SELECT COALESCE(album.published_at, album.updated_at, album.created_at)
  FROM archive_albums album
  WHERE album.id = logjam_submissions.promoted_album_id
)
WHERE source_locked_at IS NULL
  AND sealed_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM archive_albums album
    WHERE album.id = logjam_submissions.promoted_album_id
      AND (album.published_at IS NOT NULL OR album.status = 'published')
  );
