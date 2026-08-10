-- Allow each GT season to expose only the classes that actually competed,
-- preserve track configurations, and represent drivers who scored in more
-- than one class during the same historical season.
CREATE TABLE IF NOT EXISTS gt_season_classes (
  season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE,
  class_key TEXT NOT NULL CHECK (class_key IN ('gt3-am','gt3-pro','gtp')),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (season_id, class_key)
);

INSERT OR IGNORE INTO gt_season_classes(season_id,class_key,label,sort_order)
SELECT id,'gt3-am','GT3 AM',1 FROM gt_seasons;
INSERT OR IGNORE INTO gt_season_classes(season_id,class_key,label,sort_order)
SELECT id,'gt3-pro','GT3 Pro',2 FROM gt_seasons;
INSERT OR IGNORE INTO gt_season_classes(season_id,class_key,label,sort_order)
SELECT id,'gtp','GTP',3 FROM gt_seasons;

ALTER TABLE gt_events ADD COLUMN track_config TEXT NOT NULL DEFAULT '';

CREATE TABLE gt_driver_assignments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id TEXT NOT NULL REFERENCES gt_seasons(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL,
  driver_name TEXT NOT NULL,
  class_key TEXT NOT NULL CHECK (class_key IN ('gt3-am','gt3-pro','gtp')),
  team_name TEXT NOT NULL DEFAULT '',
  car_name TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id,customer_id,class_key)
);
INSERT INTO gt_driver_assignments_new(id,season_id,customer_id,driver_name,class_key,team_name,car_name,updated_at)
SELECT id,season_id,customer_id,driver_name,class_key,team_name,car_name,updated_at
FROM gt_driver_assignments;
DROP TABLE gt_driver_assignments;
ALTER TABLE gt_driver_assignments_new RENAME TO gt_driver_assignments;
CREATE INDEX idx_gt_assignments_season ON gt_driver_assignments(season_id,class_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_result_import_driver_class
ON gt_results(import_id,customer_id,driver_name,class_key);
