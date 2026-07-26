-- Align persisted defaults with the public thumb/display/expanded pipeline.

INSERT INTO admin_settings (key, value, updated_at)
VALUES (
  'archive',
  '{"defaultAlbumStatus":"draft","defaultPhotoStatus":"review","expandedTargetMb":5,"publicDownloadMode":"none","downloadJpegTargetMb":5,"sourceJpegPublicAllowed":false,"trashRetentionDays":7,"derivativeColorProfile":"srgb","sourceJpegPolicy":"preserve","publicExifPolicy":"strip-sensitive"}',
  CURRENT_TIMESTAMP
)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
