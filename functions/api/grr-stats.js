import { cachedPublicGet } from '../_shared/publicCache.js'
import { observedFirst } from '../_shared/d1Observability.js'

const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  })

async function loadStats({ env }) {
  if (!env.INDYCAR_DB) return json({ error: 'GRR statistics are not configured.' }, 503)

  const stats = await observedFirst(env.INDYCAR_DB.prepare(`
    WITH race_results AS (
      SELECT LOWER(TRIM(d.display_name)) AS driver, r.event_id, COALESCE(r.laps_completed, 0) AS laps, 'cup' AS league
      FROM cup_results r
      JOIN cup_sessions cs ON cs.srh_race_id = r.srh_race_id AND cs.session_type = 'RACE'
      JOIN cup_drivers d ON d.srh_driver_id = r.srh_driver_id
      JOIN cup_seasons s ON s.id = r.season_id AND s.status <> 'draft'
      UNION ALL
      SELECT LOWER(TRIM(r.driver_name)), r.event_id, COALESCE(r.laps_completed, 0), 'gt'
      FROM gt_results r
      JOIN gt_seasons s ON s.id = r.season_id AND s.status <> 'draft'
      UNION ALL
      SELECT LOWER(TRIM(r.driver_name)), r.event_id, COALESCE(r.laps_completed, 0), 'indycar'
      FROM indy_results r
      JOIN indy_seasons s ON s.id = r.season_id AND s.status <> 'draft'
    )
    SELECT
      COUNT(DISTINCT driver) AS uniqueDrivers,
      COUNT(DISTINCT league || ':' || event_id) AS races,
      COALESCE(SUM(laps), 0) AS totalLaps
    FROM race_results
    WHERE driver <> ''
  `), env, '/api/grr-stats', 'all-public-race-totals')

  return json({
    uniqueDrivers: Number(stats?.uniqueDrivers) || 0,
    races: Number(stats?.races) || 0,
    totalLaps: Number(stats?.totalLaps) || 0,
  })
}

export async function onRequestGet(context) {
  return cachedPublicGet(context, 3600, () => loadStats(context))
}
