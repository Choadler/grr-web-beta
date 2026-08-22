CREATE TABLE sponsorship_inquiries (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_website TEXT,
  league TEXT NOT NULL CHECK (league IN ('Cup Series', 'GT League', 'IndyCar', 'Any league')),
  race_name TEXT NOT NULL,
  bid TEXT NOT NULL,
  brand_info TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed', 'declined')),
  admin_notes TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE TABLE sponsorship_logos (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES sponsorship_inquiries(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sponsorship_inquiries_status_submitted ON sponsorship_inquiries(status, submitted_at DESC);
CREATE INDEX idx_sponsorship_logos_inquiry ON sponsorship_logos(inquiry_id, sort_order);
