CREATE TABLE IF NOT EXISTS indy_seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  race_time TEXT NOT NULL DEFAULT '20:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indy_points_configs (
  season_id TEXT PRIMARY KEY REFERENCES indy_seasons(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indy_events (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES indy_seasons(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  race_date TEXT NOT NULL,
  track TEXT NOT NULL,
  laps INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed')),
  subsession_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (season_id, round_number)
);

CREATE TABLE IF NOT EXISTS indy_imports (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES indy_seasons(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES indy_events(id) ON DELETE CASCADE,
  subsession_id INTEGER,
  filename TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indy_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id TEXT NOT NULL REFERENCES indy_imports(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES indy_seasons(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES indy_events(id) ON DELETE CASCADE,
  customer_id INTEGER,
  driver_name TEXT NOT NULL,
  finish_position INTEGER NOT NULL,
  start_position INTEGER NOT NULL DEFAULT 0,
  laps_completed INTEGER NOT NULL DEFAULT 0,
  laps_led INTEGER NOT NULL DEFAULT 0,
  incidents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '',
  fastest_lap INTEGER NOT NULL DEFAULT 0,
  base_points INTEGER NOT NULL DEFAULT 0,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  penalty_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_indy_events_season ON indy_events(season_id, round_number);
CREATE INDEX IF NOT EXISTS idx_indy_results_season ON indy_results(season_id, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_indy_results_event ON indy_results(event_id, finish_position);

