ALTER TABLE archive_albums
ADD COLUMN photo_order_direction TEXT NOT NULL DEFAULT 'forward'
CHECK (photo_order_direction IN ('forward', 'reverse'));
