CREATE TABLE sporting_code_documents (
  league TEXT PRIMARY KEY CHECK (league IN ('cup', 'gt')),
  draft_json TEXT,
  published_json TEXT,
  draft_updated_at TEXT,
  published_at TEXT,
  published_by TEXT
);

CREATE TABLE sporting_code_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league TEXT NOT NULL CHECK (league IN ('cup', 'gt')),
  document_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL
);

CREATE INDEX idx_sporting_code_revisions_league
  ON sporting_code_revisions (league, id DESC);
