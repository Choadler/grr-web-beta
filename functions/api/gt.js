const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' },
  })
const classes = ['gt3-am', 'gt3-pro', 'gtp']
const labels = { 'gt3-am': 'GT3 AM', 'gt3-pro': 'GT3 Pro', gtp: 'GTP' }
const intervalNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/^\+/, ''))
  return Number.isFinite(parsed) ? parsed : null
}
const formatClassInterval = (row, leader) => {
  if (row.class_position === 1) return '-'
  const down = Math.max(0, Number(leader?.laps_completed) - Number(row.laps_completed))
  if (down) return `${down} Lap${down === 1 ? '' : 's'}`
  const value = intervalNumber(row.finish_interval)
  const base = intervalNumber(leader?.finish_interval)
  if (value === null || base === null || value <= base) return '-'
  return `+${((value - base) / 10000).toFixed(3)}`
}

export async function onRequestGet({ env }) {
  if (!env.INDYCAR_DB) return json({ error: 'In-house GT data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  const season = await db
    .prepare(
      "SELECT id,name,status,race_time AS raceTime,timezone FROM gt_seasons WHERE status='active' LIMIT 1",
    )
    .first()
  if (!season) return json({ error: 'No active in-house GT season.' }, 404)
  const [eventData, resultData] = await Promise.all([
    db
      .prepare(
        'SELECT id,round_number AS round,race_date AS date,track,laps,race_format AS format,status,subsession_id AS subsessionId FROM gt_events WHERE season_id=? ORDER BY round_number',
      )
      .bind(season.id)
      .all(),
    db
      .prepare(
        'SELECT * FROM gt_results WHERE season_id=? ORDER BY event_id,class_key,class_position',
      )
      .bind(season.id)
      .all(),
  ])
  const rows = resultData.results
  const standings = {}
  const teamStandings = {}
  for (const classKey of classes) {
    const aggregate = new Map()
    const teams = new Map()
    rows
      .filter((row) => row.class_key === classKey)
      .forEach((row) => {
        const key = row.customer_id
          ? `id:${row.customer_id}`
          : `name:${row.driver_name.toLowerCase()}`
        const item = aggregate.get(key) ?? {
          driver: row.driver_name,
          car: row.car_name,
          points: 0,
          starts: 0,
          wins: 0,
          podiums: 0,
        }
        item.points += row.total_points
        item.starts += 1
        item.wins += row.class_position === 1 ? 1 : 0
        item.podiums += row.class_position <= 3 ? 1 : 0
        aggregate.set(key, item)
        if (row.team_name) {
          const team = teams.get(row.team_name) ?? {
            driver: row.team_name,
            car: row.car_name,
            points: 0,
            starts: 0,
            wins: 0,
            podiums: 0,
          }
          team.points += row.total_points
          team.starts += 1
          team.wins += row.class_position === 1 ? 1 : 0
          team.podiums += row.class_position <= 3 ? 1 : 0
          teams.set(row.team_name, team)
        }
      })
    const rank = (items) =>
      [...items.values()]
        .sort((a, b) => b.points - a.points || b.wins - a.wins)
        .map((item, index) => ({ rank: index + 1, ...item }))
    standings[classKey] = rank(aggregate)
    teamStandings[classKey] = rank(teams)
  }
  const schedule = eventData.results.map((event) => {
    const eventRows = rows.filter((row) => row.event_id === event.id)
    const winner = (key) =>
      eventRows.find((row) => row.class_key === key && row.class_position === 1)?.driver_name || '—'
    return {
      round: event.round,
      date: event.date,
      track: event.track,
      am: winner('gt3-am'),
      pro: winner('gt3-pro'),
      gtp: winner('gtp'),
      state: event.status === 'completed' ? 'done' : 'upcoming',
    }
  })
  const next = schedule.find((event) => event.state === 'upcoming')
  if (next) next.state = 'next'
  const events = eventData.results
    .filter((event) => event.status === 'completed')
    .map((event) => ({
      id: event.subsessionId ?? event.round,
      label: `${event.track} — ${event.date}`,
      sessions: [
        {
          id: (event.subsessionId ?? event.round) * 10 - 1,
          label: 'Overall',
          rows: rows
            .filter((row) => row.event_id === event.id)
            .sort((a, b) => Number(a.overall_position) - Number(b.overall_position))
            .map((row) => ({
              position: row.overall_position,
              podiumPosition: row.class_position,
              driver: row.driver_name,
              class: labels[row.class_key] || row.class_key,
              car: row.car_name,
              start: row.start_position,
              interval: Number(row.overall_position) === 1 ? '-' : row.finish_interval,
              laps: row.laps_completed,
              led: row.laps_led,
              racePoints: row.base_points,
              bonus: row.bonus_points,
              penalty: row.penalty_points,
              total: row.total_points,
              incidents: row.incidents,
              status: row.status,
              pole: row.pole,
              fastestLap: row.fastest_lap,
            })),
        },
        ...classes.map((classKey, index) => {
          const classRows = rows.filter(
            (row) => row.event_id === event.id && row.class_key === classKey,
          )
          const leader = classRows.find((row) => row.class_position === 1)
          const fastestTime = Math.min(
            ...classRows
              .filter((row) => Number(row.best_lap_time) > 0)
              .map((row) => Number(row.best_lap_time)),
          )
          return {
            id: (event.subsessionId ?? event.round) * 10 + index,
            label: labels[classKey],
            rows: classRows.map((row) => ({
              position: row.class_position,
              driver: row.driver_name,
              car: row.car_name,
              start: row.start_position,
              interval: formatClassInterval(row, leader),
              laps: row.laps_completed,
              led: row.laps_led,
              racePoints: row.base_points,
              bonus: row.bonus_points,
              penalty: row.penalty_points,
              total: row.total_points,
              incidents: row.incidents,
              status: row.status,
              pole: row.pole,
              fastestLap:
                Number(row.best_lap_time) > 0 && Number(row.best_lap_time) === fastestTime ? 1 : 0,
            })),
          }
        }),
      ],
    }))
  return json({ season, schedule, standings, teamStandings, events, source: 'in-house' })
}
