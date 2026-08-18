CREATE TABLE IF NOT EXISTS cup_seasons (
  id TEXT PRIMARY KEY,
  srh_series_id INTEGER NOT NULL DEFAULT 12921,
  srh_season_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'archived' CHECK (status IN ('draft','active','archived')),
  source_url TEXT NOT NULL,
  created_source_at TEXT,
  last_synced_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cup_drivers (
  srh_driver_id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cup_events (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES cup_seasons(id) ON DELETE CASCADE,
  srh_schedule_id INTEGER NOT NULL UNIQUE,
  round_number INTEGER NOT NULL,
  race_date TEXT,
  track TEXT NOT NULL DEFAULT '',
  track_config TEXT NOT NULL DEFAULT '',
  event_name TEXT,
  scheduled_laps INTEGER,
  points_count INTEGER NOT NULL DEFAULT 1,
  source_url TEXT NOT NULL,
  UNIQUE(season_id, round_number)
);

CREATE TABLE IF NOT EXISTS cup_sessions (
  srh_race_id INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES cup_events(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,
  session_number REAL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cup_results (
  srh_race_participant_id INTEGER PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES cup_seasons(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES cup_events(id) ON DELETE CASCADE,
  srh_race_id INTEGER NOT NULL REFERENCES cup_sessions(srh_race_id) ON DELETE CASCADE,
  srh_driver_id INTEGER NOT NULL REFERENCES cup_drivers(srh_driver_id),
  finish_position INTEGER,
  start_position INTEGER,
  laps_completed INTEGER,
  laps_led INTEGER,
  incidents INTEGER,
  status TEXT,
  fastest_lap_time INTEGER,
  race_points INTEGER,
  stage_points INTEGER,
  bonus_points INTEGER,
  penalty_points INTEGER,
  total_points INTEGER,
  average_position REAL,
  passes INTEGER,
  quality_passes INTEGER,
  UNIQUE(srh_race_id, srh_driver_id)
);

CREATE TABLE IF NOT EXISTS cup_standings (
  season_id TEXT NOT NULL REFERENCES cup_seasons(id) ON DELETE CASCADE,
  srh_driver_id INTEGER NOT NULL REFERENCES cup_drivers(srh_driver_id),
  championship_position INTEGER,
  points INTEGER,
  starts INTEGER,
  wins INTEGER,
  stage_wins INTEGER,
  poles INTEGER,
  top5 INTEGER,
  top10 INTEGER,
  laps_led INTEGER,
  PRIMARY KEY (season_id, srh_driver_id)
);

CREATE INDEX IF NOT EXISTS idx_cup_events_season ON cup_events(season_id,round_number);
CREATE INDEX IF NOT EXISTS idx_cup_results_season_driver ON cup_results(season_id,srh_driver_id);
CREATE INDEX IF NOT EXISTS idx_cup_results_event ON cup_results(event_id,srh_race_id,finish_position);
