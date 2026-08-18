import { canonicalGtTrackName } from '../_shared/gtTrackNames.js'

const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  })

export async function onRequestGet({ env }) {
  if (!env.INDYCAR_DB) return json({ error: 'GRR comparison data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  const [cupSeasons, cupRaces, cupResults, gtSeasons, gtRaces, gtResults, indySeasons, indyRaces, indyResults] = await Promise.all([
    db.prepare("SELECT id,name FROM cup_seasons WHERE status<>'draft' ORDER BY srh_season_id").all(),
    db.prepare(`SELECT e.id,e.season_id AS seasonId,e.round_number AS round,e.race_date AS date,e.track
      FROM cup_events e JOIN cup_seasons s ON s.id=e.season_id
      WHERE s.status<>'draft' AND EXISTS (SELECT 1 FROM cup_sessions cs JOIN cup_results r ON r.srh_race_id=cs.srh_race_id WHERE cs.event_id=e.id AND cs.session_type='RACE')
      ORDER BY e.race_date,e.round_number`).all(),
    db.prepare(`SELECT race.event_id AS eventId,r.srh_driver_id AS driverId,d.display_name AS driver,r.finish_position AS finish,r.start_position AS start,
      r.laps_led AS lapsLed,r.status,r.fastest_lap_time AS fastestLapTime,
      COALESCE(r.total_points,0)+COALESCE((SELECT SUM(seg.stage_points) FROM cup_sessions sc JOIN cup_results seg ON seg.srh_race_id=sc.srh_race_id WHERE sc.event_id=race.event_id AND sc.session_type='SEGMENT' AND seg.srh_driver_id=r.srh_driver_id),0) AS points,
      COALESCE((SELECT SUM(seg.stage_points) FROM cup_sessions sc JOIN cup_results seg ON seg.srh_race_id=sc.srh_race_id WHERE sc.event_id=race.event_id AND sc.session_type='SEGMENT' AND seg.srh_driver_id=r.srh_driver_id),0) AS stagePoints,
      COALESCE((SELECT COUNT(*) FROM cup_sessions sc JOIN cup_results seg ON seg.srh_race_id=sc.srh_race_id WHERE sc.event_id=race.event_id AND sc.session_type='SEGMENT' AND seg.srh_driver_id=r.srh_driver_id AND seg.finish_position=1),0) AS stageWins
      FROM cup_sessions race JOIN cup_results r ON r.srh_race_id=race.srh_race_id JOIN cup_drivers d ON d.srh_driver_id=r.srh_driver_id
      WHERE race.session_type='RACE' ORDER BY race.event_id,r.finish_position`).all(),
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
    cup: { seasons: cupSeasons.results, races: cupRaces.results, results: cupResults.results },
    gt: { seasons: gtSeasons.results, races: gtRaces.results.map((race) => ({ ...race, track: canonicalGtTrackName(race.track) })), results: gtResults.results },
    indycar: {
      seasons: indySeasons.results,
      races: indyRaces.results,
      results: indyResults.results,
    },
  })
}
