ALTER TABLE cup_seasons ADD COLUMN chase_enabled INTEGER NOT NULL DEFAULT 1 CHECK (chase_enabled IN (0, 1));
ALTER TABLE cup_seasons ADD COLUMN regular_season_races INTEGER NOT NULL DEFAULT 26 CHECK (regular_season_races > 0);
ALTER TABLE cup_seasons ADD COLUMN chase_size INTEGER NOT NULL DEFAULT 16 CHECK (chase_size > 0);
ALTER TABLE cup_seasons ADD COLUMN max_points_per_race INTEGER NOT NULL DEFAULT 66 CHECK (max_points_per_race > 0);
