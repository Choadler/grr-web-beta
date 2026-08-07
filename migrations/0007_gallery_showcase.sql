ALTER TABLE gallery_photos
  ADD COLUMN showcase_enabled INTEGER NOT NULL DEFAULT 1 CHECK (showcase_enabled IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_gallery_photos_showcase
  ON gallery_photos(status, showcase_enabled, league, submitted_at DESC);
