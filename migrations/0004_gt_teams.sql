CREATE TABLE IF NOT EXISTS gt_teams (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  class_key TEXT NOT NULL CHECK (class_key IN ('gt3-am','gt3-pro','gtp')),
  car_name TEXT NOT NULL DEFAULT '',
  members_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id,team_name,class_key)
);
CREATE INDEX IF NOT EXISTS idx_gt_teams_season ON gt_teams(season_id,class_key);
