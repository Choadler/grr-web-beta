-- Enforce one public season per managed league and ensure imports/results
-- cannot be attached to an event from another season.
ALTER TABLE gt_seasons ADD COLUMN legacy_roster_fallback INTEGER NOT NULL DEFAULT 0;
UPDATE gt_seasons SET legacy_roster_fallback = 1;

UPDATE indy_seasons SET status = 'archived', updated_at = CURRENT_TIMESTAMP
WHERE status = 'active' AND rowid NOT IN (
  SELECT rowid FROM indy_seasons WHERE status = 'active'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
);
UPDATE gt_seasons SET status = 'archived', updated_at = CURRENT_TIMESTAMP
WHERE status = 'active' AND rowid NOT IN (
  SELECT rowid FROM gt_seasons WHERE status = 'active'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_indy_one_active_season ON indy_seasons(status) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_one_active_season ON gt_seasons(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_indy_imports_season_event ON indy_imports(season_id, event_id);
CREATE INDEX IF NOT EXISTS idx_gt_imports_season_event ON gt_imports(season_id, event_id);

CREATE TRIGGER IF NOT EXISTS indy_import_season_insert BEFORE INSERT ON indy_imports
WHEN NOT EXISTS (SELECT 1 FROM indy_events WHERE id = NEW.event_id AND season_id = NEW.season_id)
BEGIN SELECT RAISE(ABORT, 'IndyCar import season does not match its event'); END;

CREATE TRIGGER IF NOT EXISTS indy_result_season_insert BEFORE INSERT ON indy_results
WHEN NOT EXISTS (
  SELECT 1 FROM indy_events e JOIN indy_imports i ON i.id = NEW.import_id
  WHERE e.id = NEW.event_id AND e.season_id = NEW.season_id
    AND i.event_id = NEW.event_id AND i.season_id = NEW.season_id
)
BEGIN SELECT RAISE(ABORT, 'IndyCar result ownership is inconsistent'); END;

CREATE TRIGGER IF NOT EXISTS gt_import_season_insert BEFORE INSERT ON gt_imports
WHEN NOT EXISTS (SELECT 1 FROM gt_events WHERE id = NEW.event_id AND season_id = NEW.season_id)
BEGIN SELECT RAISE(ABORT, 'GT import season does not match its event'); END;

CREATE TRIGGER IF NOT EXISTS gt_result_season_insert BEFORE INSERT ON gt_results
WHEN NOT EXISTS (
  SELECT 1 FROM gt_events e JOIN gt_imports i ON i.id = NEW.import_id
  WHERE e.id = NEW.event_id AND e.season_id = NEW.season_id
    AND i.event_id = NEW.event_id AND i.season_id = NEW.season_id
)
BEGIN SELECT RAISE(ABORT, 'GT result ownership is inconsistent'); END;
