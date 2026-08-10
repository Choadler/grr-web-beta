import { canonicalGtTrackName } from '../_shared/gtTrackNames.js'

const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  })

export async function onRequestGet({ env }) {
  if (!env.INDYCAR_DB) return json({ error: 'GRR comparison data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  const [gtSeasons, gtRaces, gtResults, indySeasons, indyRaces, indyResults] = await Promise.all([
    db.prepare("SELECT id,name FROM gt_seasons WHERE status<>'draft' ORDER BY created_at").all(),
    db
      .prepare(
        "SELECT e.id,e.season_id AS seasonId,e.round_number AS round,e.race_date AS date,e.track FROM gt_events e JOIN gt_seasons s ON s.id=e.season_id WHERE e.status='completed' AND s.status<>'draft' ORDER BY e.race_date,e.round_number",
      )
      .all(),
    db
      .prepare(
        'SELECT event_id AS eventId,customer_id AS customerId,driver_name AS driver,class_key AS classKey,class_position AS classPosition,overall_position AS overallPosition,start_position AS start,laps_led AS lapsLed,status,pole,fastest_lap AS fastestLap,total_points AS points FROM gt_results ORDER BY event_id,overall_position',
      )
      .all(),
    db.prepare("SELECT id,name FROM indy_seasons WHERE status<>'draft' ORDER BY created_at").all(),
    db
      .prepare(
        "SELECT e.id,e.season_id AS seasonId,e.round_number AS round,e.race_date AS date,e.track FROM indy_events e JOIN indy_seasons s ON s.id=e.season_id WHERE e.status='completed' AND s.status<>'draft' ORDER BY e.race_date,e.round_number",
      )
      .all(),
    db
      .prepare(
        'SELECT event_id AS eventId,customer_id AS customerId,driver_name AS driver,finish_position AS finish,start_position AS start,laps_led AS lapsLed,status,fastest_lap AS fastestLap,total_points AS points FROM indy_results ORDER BY event_id,finish_position',
      )
      .all(),
  ])
  return json({
    gt: { seasons: gtSeasons.results, races: gtRaces.results.map((race) => ({ ...race, track: canonicalGtTrackName(race.track) })), results: gtResults.results },
    indycar: {
      seasons: indySeasons.results,
      races: indyRaces.results,
      results: indyResults.results,
    },
  })
}
