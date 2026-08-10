-- Restore the single fastest-lap award for archived GT event/classes that have
-- valid lap times but lost both the stored flag and historical one-point bonus.
WITH missing_groups AS (
  SELECT r.event_id,r.class_key
  FROM gt_results r
  JOIN gt_seasons s ON s.id=r.season_id
  WHERE s.status='archived'
  GROUP BY r.event_id,r.class_key
  HAVING SUM(CASE WHEN r.best_lap_time>0 THEN 1 ELSE 0 END)>0
    AND SUM(r.fastest_lap)=0
), ranked AS (
  SELECT r.id,r.event_id,r.class_key,
    ROW_NUMBER() OVER (
      PARTITION BY r.event_id,r.class_key
      ORDER BY r.best_lap_time,r.overall_position,r.id
    ) AS lap_rank
  FROM gt_results r
  JOIN missing_groups m ON m.event_id=r.event_id AND m.class_key=r.class_key
  WHERE r.best_lap_time>0
)
UPDATE gt_results
SET fastest_lap=1,
  bonus_points=bonus_points+1,
  total_points=total_points+1
WHERE id IN (SELECT id FROM ranked WHERE lap_rank=1);

-- Standardize verified aliases without collapsing distinct venue layouts.
UPDATE gt_events SET track=CASE LOWER(TRIM(track))
  WHEN 'algarve' THEN 'Algarve International Circuit'
  WHEN 'imola' THEN 'Autodromo Internazionale Enzo e Dino Ferrari'
  WHEN 'monza' THEN 'Autodromo Nazionale Monza'
  WHEN 'ctmp' THEN 'Canadian Tire Motorsports Park'
  WHEN 'spa' THEN 'Circuit de Spa-Francorchamps'
  WHEN 'le mans' THEN 'Circuit des 24 Heures du Mans'
  WHEN 'daytona' THEN 'Daytona International Speedway'
  WHEN 'sebring' THEN 'Sebring International Raceway'
  WHEN 'vir' THEN 'Virginia International Raceway'
  WHEN 'watkins glen' THEN 'Watkins Glen International'
  ELSE track
END;
