CREATE INDEX IF NOT EXISTS idx_cup_sessions_event_type_race
ON cup_sessions(event_id, session_type, srh_race_id);
