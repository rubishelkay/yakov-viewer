-- Yakov Viewer archive foundation for Cloudflare D1.
-- Draft migration: safe to commit, contains no secrets or account-specific IDs.

CREATE TABLE IF NOT EXISTS archive_sets (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'hidden', 'trash', 'deleted')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  layout_mode TEXT NOT NULL CHECK (layout_mode IN ('fullscreen-carousel', 'triptych', 'quad-feature', 'six-grid', 'nine-grid', 'editorial-row', 'split-feature', 'panorama-strip', 'custom')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS archive_albums (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'hidden', 'trash', 'deleted')),
  public_download_policy TEXT NOT NULL CHECK (public_download_policy IN ('inherit', 'none', 'expanded', 'downloadJpeg')),
  cover_landscape_asset_id TEXT,
  cover_portrait_asset_id TEXT,
  cover_square_asset_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  date_start TEXT,
  date_end TEXT,
  location_text TEXT,
  camera TEXT,
  film_stock TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS archive_photos (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES archive_albums(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'hidden', 'trash', 'deleted')),
  position INTEGER NOT NULL DEFAULT 0,
  frame_number INTEGER,
  public_download_override TEXT CHECK (public_download_override IN ('inherit', 'none', 'expanded', 'downloadJpeg')),
  date_taken TEXT,
  location_text TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  dominant_color TEXT NOT NULL DEFAULT '#111111',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  hidden_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS archive_assets (
  id TEXT PRIMARY KEY,
  photo_id TEXT REFERENCES archive_photos(id) ON DELETE CASCADE,
  album_id TEXT REFERENCES archive_albums(id) ON DELETE SET NULL,
  version TEXT NOT NULL CHECK (version IN ('thumb', 'display', 'expanded', 'downloadJpeg', 'sourceJpeg', 'master')),
  access TEXT NOT NULL CHECK (access IN ('public', 'private')),
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  public_url TEXT,
  width INTEGER,
  height INTEGER,
  bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  color_profile TEXT NOT NULL DEFAULT 'srgb',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archive_tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('album', 'photo', 'both')),
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS set_albums (
  set_id TEXT NOT NULL REFERENCES archive_sets(id) ON DELETE CASCADE,
  album_id TEXT NOT NULL REFERENCES archive_albums(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (set_id, album_id)
);

CREATE TABLE IF NOT EXISTS album_tags (
  album_id TEXT NOT NULL REFERENCES archive_albums(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES archive_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, tag_id)
);

CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id TEXT NOT NULL REFERENCES archive_photos(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES archive_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, tag_id)
);

CREATE TABLE IF NOT EXISTS archive_collections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'hidden', 'trash', 'deleted')),
  cover_asset_id TEXT REFERENCES archive_assets(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS collection_photos (
  collection_id TEXT NOT NULL REFERENCES archive_collections(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES archive_photos(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, photo_id)
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_jobs (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES archive_albums(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'uploading', 'processing', 'review', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trash_items (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('set', 'album', 'photo', 'asset', 'collection')),
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  purge_after TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_archive_sets_status_order ON archive_sets(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_archive_albums_status_order ON archive_albums(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_archive_photos_album_position ON archive_photos(album_id, position);
CREATE INDEX IF NOT EXISTS idx_archive_photos_status ON archive_photos(status);
CREATE INDEX IF NOT EXISTS idx_archive_assets_photo_version ON archive_assets(photo_id, version);
CREATE INDEX IF NOT EXISTS idx_set_albums_set_position ON set_albums(set_id, position);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_album_status ON upload_jobs(album_id, status);
