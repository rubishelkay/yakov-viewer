-- Production admin mutations and recoverable purge support.

ALTER TABLE archive_albums
ADD COLUMN cover_priority TEXT NOT NULL DEFAULT 'landscape'
CHECK (cover_priority IN ('landscape', 'square', 'portrait'));

ALTER TABLE trash_items
ADD COLUMN restore_status TEXT
CHECK (restore_status IN ('draft', 'review', 'published', 'hidden', 'trash', 'deleted'));

ALTER TABLE trash_items
ADD COLUMN restore_payload TEXT;

CREATE TABLE IF NOT EXISTS purge_jobs (
  id TEXT PRIMARY KEY,
  trash_item_id TEXT NOT NULL UNIQUE REFERENCES trash_items(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('set', 'album', 'photo', 'asset', 'collection')),
  entity_id TEXT NOT NULL,
  object_manifest TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('pending', 'deleting', 'failed', 'done')),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purge_jobs_status ON purge_jobs(status, updated_at);
