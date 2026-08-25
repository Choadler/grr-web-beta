CREATE TABLE IF NOT EXISTS cup_penalties (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES cup_seasons(id) ON DELETE CASCADE,
  srh_driver_id INTEGER NOT NULL REFERENCES cup_drivers(srh_driver_id),
  driver_name_snapshot TEXT NOT NULL,
  event_id TEXT REFERENCES cup_events(id) ON DELETE SET NULL,
  event_name_snapshot TEXT NOT NULL,
  event_round_snapshot INTEGER,
  event_date_snapshot TEXT,
  adjustment INTEGER NOT NULL,
  penalty_type TEXT NOT NULL CHECK (penalty_type IN ('AT_FAULT_INCIDENT','CLEAN_RACE','ADMIN_ADJUSTMENT','APPEAL_ADJUSTMENT','SUSPENSION_REDUCTION','OTHER')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','UNDER_APPEAL','OVERTURNED')),
  appeal_note TEXT,
  admin_note TEXT,
  created_by TEXT,
  system_generated INTEGER NOT NULL DEFAULT 0 CHECK (system_generated IN (0,1)),
  related_sanction_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cup_sanctions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES cup_seasons(id) ON DELETE CASCADE,
  srh_driver_id INTEGER NOT NULL REFERENCES cup_drivers(srh_driver_id),
  driver_name_snapshot TEXT NOT NULL,
  sanction_type TEXT NOT NULL CHECK (sanction_type IN ('QUALIFYING_BAN','RACE_SUSPENSION')),
  triggering_balance INTEGER NOT NULL,
  trigger_penalty_id TEXT REFERENCES cup_penalties(id) ON DELETE SET NULL,
  target_event_id TEXT REFERENCES cup_events(id) ON DELETE SET NULL,
  target_event_name_snapshot TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SERVED','WAIVED')),
  served_at TEXT,
  waived_at TEXT,
  admin_notes TEXT,
  related_adjustment_id TEXT REFERENCES cup_penalties(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cup_penalties_season_driver ON cup_penalties(season_id,srh_driver_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_cup_penalties_event ON cup_penalties(event_id);
CREATE INDEX IF NOT EXISTS idx_cup_sanctions_season_driver ON cup_sanctions(season_id,srh_driver_id,created_at,id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cup_sanctions_pending_type ON cup_sanctions(season_id,srh_driver_id,sanction_type) WHERE status='PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS idx_cup_penalties_suspension_reduction ON cup_penalties(related_sanction_id) WHERE penalty_type='SUSPENSION_REDUCTION';
