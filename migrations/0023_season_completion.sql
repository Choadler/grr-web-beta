-- Season publication state (draft/active/archived) and championship completion
-- are separate concerns. Admins explicitly finalize a championship; no date or
-- result-count inference is used by the public celebration.
ALTER TABLE indy_seasons ADD COLUMN is_complete INTEGER NOT NULL DEFAULT 0 CHECK (is_complete IN (0,1));
ALTER TABLE gt_seasons ADD COLUMN is_complete INTEGER NOT NULL DEFAULT 0 CHECK (is_complete IN (0,1));
ALTER TABLE cup_seasons ADD COLUMN is_complete INTEGER NOT NULL DEFAULT 0 CHECK (is_complete IN (0,1));
