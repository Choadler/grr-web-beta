CREATE TABLE gallery_submission_batches (
  batch_id TEXT PRIMARY KEY,
  client_ip_hash TEXT NOT NULL,
  batch_size INTEGER NOT NULL CHECK (batch_size BETWEEN 1 AND 10),
  next_index INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE gallery_photos ADD COLUMN submission_batch_id TEXT;
ALTER TABLE gallery_photos ADD COLUMN submission_batch_index INTEGER;

CREATE UNIQUE INDEX idx_gallery_submission_batch_photo
  ON gallery_photos(submission_batch_id, submission_batch_index)
  WHERE submission_batch_id IS NOT NULL;

CREATE INDEX idx_gallery_submission_batches_expires
  ON gallery_submission_batches(expires_at);
