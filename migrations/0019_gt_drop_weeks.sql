ALTER TABLE gt_seasons ADD COLUMN drop_weeks INTEGER NOT NULL DEFAULT 0 CHECK (drop_weeks >= 0);
ALTER TABLE gt_seasons ADD COLUMN drop_start_round INTEGER NOT NULL DEFAULT 2 CHECK (drop_start_round > 0);
