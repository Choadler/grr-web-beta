ALTER TABLE gt_events ADD COLUMN race_format TEXT NOT NULL DEFAULT 'standard'
  CHECK (race_format IN ('standard', 'endurance'));

CREATE TABLE IF NOT EXISTS gt_format_points_configs (
  season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE,
  format_key TEXT NOT NULL CHECK (format_key IN ('standard', 'endurance')),
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season_id, format_key)
);

INSERT OR IGNORE INTO gt_format_points_configs(season_id, format_key, config_json)
SELECT season_id, 'standard', config_json FROM gt_points_configs WHERE class_key = 'gt3-am';

INSERT OR IGNORE INTO gt_format_points_configs(season_id, format_key, config_json)
SELECT season_id, 'endurance', config_json FROM gt_points_configs WHERE class_key = 'gt3-am';
