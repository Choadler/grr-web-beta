const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } })

export async function onRequestGet({ env }) {
  if (!env.INDYCAR_DB) return json({ error: 'In-house IndyCar data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  const season = await db.prepare("SELECT id,name,status,race_time AS raceTime,timezone FROM indy_seasons WHERE status='active' LIMIT 1").first()
  if (!season) return json({ error: 'No active in-house IndyCar season.' }, 404)
  const [scheduleData, resultData] = await Promise.all([
    db.prepare(`SELECT e.id,e.round_number AS round,e.race_date AS date,e.track,e.laps,e.status,e.subsession_id AS subsessionId,
      (SELECT driver_name FROM indy_results r WHERE r.event_id=e.id ORDER BY finish_position LIMIT 1) AS winner,
      (SELECT driver_name FROM indy_results r WHERE r.event_id=e.id ORDER BY start_position LIMIT 1) AS pole
      FROM indy_events e WHERE e.season_id=? ORDER BY e.round_number`).bind(season.id).all(),
    db.prepare(`SELECT r.*,e.round_number,e.race_date,e.track FROM indy_results r JOIN indy_events e ON e.id=r.event_id
      WHERE r.season_id=? ORDER BY e.round_number,r.finish_position`).bind(season.id).all(),
  ])
  const rows = resultData.results
  const aggregate = new Map()
  for (const row of rows) {
    const key = row.customer_id ? `id:${row.customer_id}` : `name:${row.driver_name.toLowerCase()}`
    const item = aggregate.get(key) ?? { driver: row.driver_name, points: 0, starts: 0, wins: 0, poles: 0, top5: 0, top10: 0, lapsLed: 0 }
    item.points += row.total_points; item.starts += 1; item.wins += row.finish_position === 1 ? 1 : 0
    item.poles += row.start_position === 1 ? 1 : 0; item.top5 += row.finish_position <= 5 ? 1 : 0
    item.top10 += row.finish_position <= 10 ? 1 : 0; item.lapsLed += row.laps_led
    aggregate.set(key, item)
  }
  const standings = [...aggregate.values()].sort((a, b) => b.points - a.points || b.wins - a.wins).map((item, index) => ({ rank: index + 1, ...item }))
  const events = scheduleData.results.filter((event) => event.status === 'completed').map((event) => ({
    id: event.subsessionId ?? event.round,
    label: `${event.track} — ${event.date}`,
    sessions: [{ id: event.subsessionId ?? event.round, label: 'Overall Race Finish', rows: rows.filter((row) => row.event_id === event.id).map((row) => ({ position: row.finish_position, driver: row.driver_name, start: row.start_position, interval: row.finish_interval || '-', laps: row.laps_completed, led: row.laps_led, racePoints: row.base_points, bonus: row.bonus_points, penalty: row.penalty_points, total: row.total_points, incidents: row.incidents, status: row.status, fastestLap: row.fastest_lap })) }],
  }))
  const schedule = scheduleData.results.map((event) => ({ round: event.round, date: event.date, track: event.track, laps: event.laps, winner: event.winner || '—', pole: event.pole || '—' }))
  return json({ season, schedule, standings, events, source: 'in-house' })
}
