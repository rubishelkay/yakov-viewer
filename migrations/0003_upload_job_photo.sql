ALTER TABLE upload_jobs
ADD COLUMN photo_id TEXT REFERENCES archive_photos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_upload_jobs_photo ON upload_jobs(photo_id);
