CREATE TABLE IF NOT EXISTS gallery_photos (
  id TEXT PRIMARY KEY,
  photographer_name TEXT NOT NULL,
  league TEXT NOT NULL CHECK (league IN ('cup', 'gt', 'indycar')),
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_public
  ON gallery_photos(status, league, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_moderation
  ON gallery_photos(status, submitted_at DESC);
