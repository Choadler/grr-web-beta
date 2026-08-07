CREATE TABLE IF NOT EXISTS gt_seasons (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  race_time TEXT NOT NULL DEFAULT '20:00', timezone TEXT NOT NULL DEFAULT 'America/New_York', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gt_points_configs (
  season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE, class_key TEXT NOT NULL CHECK (class_key IN ('gt3-am','gt3-pro','gtp')),
  config_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (season_id,class_key)
);
CREATE TABLE IF NOT EXISTS gt_events (
  id TEXT PRIMARY KEY, season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE, round_number INTEGER NOT NULL, race_date TEXT NOT NULL,
  track TEXT NOT NULL, laps INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed')), subsession_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(season_id,round_number)
);
CREATE TABLE IF NOT EXISTS gt_driver_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE, customer_id INTEGER NOT NULL,
  driver_name TEXT NOT NULL, class_key TEXT NOT NULL CHECK (class_key IN ('gt3-am','gt3-pro','gtp')), team_name TEXT NOT NULL DEFAULT '', car_name TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(season_id,customer_id)
);
CREATE TABLE IF NOT EXISTS gt_imports (
  id TEXT PRIMARY KEY, season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE, event_id TEXT NOT NULL REFERENCES gt_events(id) ON DELETE CASCADE,
  subsession_id INTEGER, filename TEXT NOT NULL, raw_json TEXT NOT NULL, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gt_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT, import_id TEXT NOT NULL REFERENCES gt_imports(id) ON DELETE CASCADE, season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES gt_events(id) ON DELETE CASCADE, customer_id INTEGER, driver_name TEXT NOT NULL, class_key TEXT NOT NULL,
  class_position INTEGER NOT NULL, overall_position INTEGER NOT NULL, start_position INTEGER NOT NULL DEFAULT 0, finish_interval TEXT NOT NULL DEFAULT '-',
  laps_completed INTEGER NOT NULL DEFAULT 0, laps_led INTEGER NOT NULL DEFAULT 0, incidents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT '',
  best_lap_time INTEGER NOT NULL DEFAULT 0, pole INTEGER NOT NULL DEFAULT 0, fastest_lap INTEGER NOT NULL DEFAULT 0, team_name TEXT NOT NULL DEFAULT '', car_name TEXT NOT NULL DEFAULT '',
  base_points INTEGER NOT NULL DEFAULT 0, bonus_points INTEGER NOT NULL DEFAULT 0, penalty_points INTEGER NOT NULL DEFAULT 0, total_points INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gt_events_season ON gt_events(season_id,round_number);
CREATE INDEX IF NOT EXISTS idx_gt_assignments_season ON gt_driver_assignments(season_id,class_key);
CREATE INDEX IF NOT EXISTS idx_gt_results_season ON gt_results(season_id,class_key,total_points DESC);
CREATE INDEX IF NOT EXISTS idx_gt_results_event ON gt_results(event_id,class_key,class_position);
