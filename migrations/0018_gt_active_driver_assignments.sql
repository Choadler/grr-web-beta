-- Keep historical GT class assignments while identifying the one that should
-- be used for future race imports.
ALTER TABLE gt_driver_assignments ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1));

-- Historical seasons may already contain more than one class row per driver.
-- Preserve every row, but treat the most recently updated row as current.
UPDATE gt_driver_assignments
SET is_active = 0
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY season_id, customer_id
        ORDER BY updated_at DESC, id DESC
      ) AS assignment_rank
    FROM gt_driver_assignments
  )
  WHERE assignment_rank > 1
);

CREATE UNIQUE INDEX idx_gt_assignments_active_driver
ON gt_driver_assignments(season_id, customer_id)
WHERE is_active = 1;
