import { canonicalGtTrackName } from '../_shared/gtTrackNames.js'
import { selectGtDropWeeks } from '../_shared/gtDropWeeks.js'
import { canonicalGtCarName } from '../_shared/gtCarNames.js'
import { compareGtStandings } from '../_shared/leagueScoring.js'

const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' },
  })
const defaultClasses = ['gt3-am', 'gt3-pro', 'gtp']
const defaultLabels = { 'gt3-am': 'GT3 AM', 'gt3-pro': 'GT3 Pro', gtp: 'GTP' }
const driverIdentity = (row) => row.customer_id
  ? `id:${row.customer_id}`
  : `name:${row.driver_name.toLowerCase()}`
const applyDriverDrops = (items, driverRows, completedEvents, season) => {
  for (const [key, item] of items) {
    item.rawPoints = item.points
    item.drops = '—'
    const pointsByEvent = new Map(driverRows.filter((row) => driverIdentity(row) === key).map((row) => [row.event_id, Number(row.total_points) || 0]))
    const selected = selectGtDropWeeks(completedEvents, pointsByEvent, season.dropWeeks, season.dropStartRound)
    if (!selected.length) continue
    const droppedPoints = selected.reduce((total, event) => total + event.points, 0)
    item.points -= droppedPoints
    item.droppedPoints = droppedPoints
    item.drops = selected.map((event) => `R${event.round} (${event.points})`).join(', ')
  }
}
const preferredDriverName = (current, candidate) => {
  if (!current) return candidate
  const currentBase = current.replace(/\d+$/, '').trim().toLowerCase()
  const candidateBase = candidate.replace(/\d+$/, '').trim().toLowerCase()
  if (currentBase === candidateBase) {
    if (/\d+$/.test(current) && !/\d+$/.test(candidate)) return candidate
    if (!/\d+$/.test(current) && /\d+$/.test(candidate)) return current
  }
  return current
}
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
const formatOverallInterval = (row, leader) => {
  if (Number(row.overall_position) === 1) return '-'
  const down = Math.max(0, Number(leader?.laps_completed) - Number(row.laps_completed))
  if (down) return `${down} Lap${down === 1 ? '' : 's'}`
  const value = intervalNumber(row.finish_interval)
  const base = intervalNumber(leader?.finish_interval)
  if (value === null || base === null || value <= base) return '-'
  return `+${((value - base) / 10000).toFixed(3)}`
}

export async function onRequestGet({ env, request }) {
  if (!env.INDYCAR_DB) return json({ error: 'In-house GT data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  const url = new URL(request.url)
  if (url.searchParams.get('list') === 'seasons') {
    const seasons = await db.prepare("SELECT id,name,status,drop_weeks AS dropWeeks,drop_start_round AS dropStartRound FROM gt_seasons WHERE status<>'draft' ORDER BY created_at DESC").all()
    const championRows = []
    for (const listedSeason of seasons.results) {
        const [seasonResults, seasonEvents, seasonClasses] = await Promise.all([
        db.prepare('SELECT r.*,e.round_number AS round FROM gt_results r JOIN gt_events e ON e.id=r.event_id WHERE r.season_id=?').bind(listedSeason.id).all(),
        db.prepare("SELECT id,round_number AS round FROM gt_events WHERE season_id=? AND status='completed' ORDER BY round_number").bind(listedSeason.id).all(),
        db.prepare('SELECT class_key AS classKey,label AS classLabel FROM gt_season_classes WHERE season_id=?').bind(listedSeason.id).all(),
      ])
      for (const classInfo of seasonClasses.results) {
        const classRows = seasonResults.results.filter((row) => row.class_key === classInfo.classKey)
        const drivers = new Map()
        for (const row of classRows) {
          const key = driverIdentity(row)
          const item = drivers.get(key) ?? { driver: row.driver_name, points: 0, wins: 0, secondPlaces: 0, poles: 0, finalRaceFinish: Number.POSITIVE_INFINITY, latestRound: 0 }
          item.points += Number(row.total_points) || 0
          item.wins += Number(row.class_position) === 1 ? 1 : 0
          item.secondPlaces += Number(row.class_position) === 2 ? 1 : 0
          item.poles += Number(row.pole) ? 1 : 0
          if (Number(row.round) >= item.latestRound) {
            item.latestRound = Number(row.round)
            item.finalRaceFinish = Number(row.class_position)
          }
          drivers.set(key, item)
        }
        applyDriverDrops(drivers, classRows, seasonEvents.results, listedSeason)
        const champion = [...drivers.values()].sort(compareGtStandings)[0]
        if (champion) championRows.push({ seasonId: listedSeason.id, ...classInfo, driver: champion.driver })
      }
    }
    return json({ seasons: seasons.results.map((season) => ({
      ...season,
      champions: championRows.filter((row) => row.seasonId === season.id),
    })) })
  }
  if (url.searchParams.get('list') === 'classes') {
    const requested = url.searchParams.get('season')
    const selected = requested
      ? await db.prepare("SELECT id FROM gt_seasons WHERE id=? AND status<>'draft'").bind(requested).first()
      : await db.prepare("SELECT id FROM gt_seasons WHERE status='active'").first()
    if (!selected) return json({ error: 'That GT season is not publicly available.' }, 404)
    const seasonClasses = await db.prepare('SELECT class_key AS key,label,sort_order AS sortOrder FROM gt_season_classes WHERE season_id=? ORDER BY sort_order').bind(selected.id).all()
    return json({ classes: seasonClasses.results })
  }
  if (url.searchParams.get('view') === 'history') {
    const historyData = await db.prepare(
      `SELECT r.customer_id AS customerId,r.driver_name AS driver,r.class_key AS classKey,
        COALESCE(c.label, r.class_key) AS classLabel,r.class_position AS classPosition,
        r.total_points AS points,r.pole,r.fastest_lap AS fastestLap,r.season_id AS seasonId
       FROM gt_results r
       JOIN gt_seasons s ON s.id=r.season_id AND s.status<>'draft'
       LEFT JOIN gt_season_classes c ON c.season_id=r.season_id AND c.class_key=r.class_key
       ORDER BY s.created_at,r.event_id,r.class_position`,
    ).all()
    const drivers = new Map()
    const classDrivers = new Map()
    for (const row of historyData.results) {
      const identity = row.customerId ? `id:${row.customerId}` : `name:${row.driver.toLowerCase()}`
      const update = (map, key, base) => {
        const item = map.get(key) ?? { ...base, starts: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, points: 0, seasons: new Set(), classes: new Set() }
        item.driverKey = identity
        item.driver = preferredDriverName(item.driver, row.driver)
        item.starts += 1
        item.wins += Number(row.classPosition) === 1 ? 1 : 0
        item.podiums += Number(row.classPosition) <= 3 ? 1 : 0
        item.poles += Number(row.pole) ? 1 : 0
        item.fastestLaps += Number(row.fastestLap) ? 1 : 0
        item.points += Number(row.points) || 0
        item.seasons.add(row.seasonId)
        item.classes.add(row.classLabel)
        map.set(key, item)
      }
      update(drivers, identity, {})
      update(classDrivers, `${row.classKey}:${identity}`, { classKey: row.classKey, classLabel: row.classLabel })
    }
    const finish = (item) => ({ ...item, seasons: item.seasons.size, classes: [...item.classes].join(', ') })
    const stats = [...drivers.values()].map(finish)
      .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.starts - a.starts || a.driver.localeCompare(b.driver))
      .map((item, index) => ({ rank: index + 1, ...item }))
    const metrics = [['wins', 'Most Wins'], ['podiums', 'Most Podiums'], ['starts', 'Most Starts'], ['poles', 'Most Poles'], ['fastestLaps', 'Most Fastest Laps']]
    const records = []
    for (const classKey of [...new Set([...classDrivers.values()].map((item) => item.classKey))]) {
      const entries = [...classDrivers.values()].filter((item) => item.classKey === classKey).map(finish)
      const classLabel = entries[0]?.classLabel ?? classKey
      for (const [key, label] of metrics) {
        const value = Math.max(0, ...entries.map((item) => item[key]))
        if (value) records.push({ classKey, classLabel, record: label, value, drivers: entries.filter((item) => item[key] === value).map((item) => item.driver).sort().join(', ') })
      }
    }
    return json({ stats, records })
  }
  if (url.searchParams.get('view') === 'career') {
    const driverKey = url.searchParams.get('driver') ?? ''
    if (!driverKey.startsWith('id:') && !driverKey.startsWith('name:')) return json({ error: 'A valid GT driver is required.' }, 400)
    const [historyData, completedEventData] = await Promise.all([db.prepare(
      `SELECT r.customer_id AS customerId,r.driver_name AS driver,r.class_key AS classKey,
        COALESCE(c.label,r.class_key) AS classLabel,r.class_position AS classPosition,
        r.total_points AS points,r.pole,r.fastest_lap AS fastestLap,r.laps_completed AS laps,
        r.incidents,r.car_name AS car,r.team_name AS team,r.season_id AS seasonId,s.name AS season,
        s.drop_weeks AS dropWeeks,s.drop_start_round AS dropStartRound,
        r.event_id AS eventId,e.round_number AS round,e.track,e.race_date AS raceDate
       FROM gt_results r
       JOIN gt_seasons s ON s.id=r.season_id AND s.status<>'draft'
       JOIN gt_events e ON e.id=r.event_id
       LEFT JOIN gt_season_classes c ON c.season_id=r.season_id AND c.class_key=r.class_key
       ORDER BY e.race_date,e.round_number`,
    ).all(), db.prepare(
      `SELECT e.id,e.season_id AS seasonId,e.round_number AS round
       FROM gt_events e JOIN gt_seasons s ON s.id=e.season_id AND s.status<>'draft'
       WHERE e.status='completed' ORDER BY e.season_id,e.round_number`,
    ).all()])
    const identity = (row) => row.customerId ? `id:${row.customerId}` : `name:${row.driver.toLowerCase()}`
    const selectedRows = historyData.results.filter((row) => identity(row) === driverKey)
    if (!selectedRows.length) return json({ error: 'That GT driver was not found.' }, 404)
    const summarize = (rows) => ({
      starts: rows.length,
      wins: rows.filter((row) => Number(row.classPosition) === 1).length,
      podiums: rows.filter((row) => Number(row.classPosition) <= 3).length,
      poles: rows.filter((row) => Number(row.pole)).length,
      fastestLaps: rows.filter((row) => Number(row.fastestLap)).length,
      points: rows.reduce((total, row) => total + (Number(row.points) || 0), 0),
      laps: rows.reduce((total, row) => total + (Number(row.laps) || 0), 0),
      incidents: rows.reduce((total, row) => total + (Number(row.incidents) || 0), 0),
      averageFinish: Number((rows.reduce((total, row) => total + Number(row.classPosition), 0) / rows.length).toFixed(2)),
      bestFinish: Math.min(...rows.map((row) => Number(row.classPosition))),
    })
    const seasonClassStandings = new Map()
    const seasonClassRows = new Map()
    for (const row of historyData.results) {
      const key = `${row.seasonId}:${row.classKey}`
      const drivers = seasonClassStandings.get(key) ?? new Map()
      const rows = seasonClassRows.get(key) ?? []
      const id = identity(row)
      const item = drivers.get(id) ?? { driverKey: id, driver: row.driver, points: 0, wins: 0, secondPlaces: 0, poles: 0, finalRaceFinish: Number.POSITIVE_INFINITY, latestRound: 0 }
      item.points += Number(row.points) || 0
      item.wins += Number(row.classPosition) === 1 ? 1 : 0
      item.secondPlaces += Number(row.classPosition) === 2 ? 1 : 0
      item.poles += Number(row.pole) ? 1 : 0
      if (Number(row.round) >= item.latestRound) {
        item.latestRound = Number(row.round)
        item.finalRaceFinish = Number(row.classPosition)
      }
      drivers.set(id, item)
      seasonClassStandings.set(key, drivers)
      rows.push({ ...row, customer_id: row.customerId, driver_name: row.driver, event_id: row.eventId, total_points: row.points })
      seasonClassRows.set(key, rows)
    }
    for (const [key, drivers] of seasonClassStandings) {
      const rows = seasonClassRows.get(key)
      const sample = rows[0]
      applyDriverDrops(
        drivers,
        rows,
        completedEventData.results.filter((event) => event.seasonId === sample.seasonId),
        sample,
      )
    }
    const rankFor = (seasonId, classKey) => [...seasonClassStandings.get(`${seasonId}:${classKey}`).values()]
      .sort(compareGtStandings)
      .findIndex((item) => item.driverKey === driverKey) + 1
    const group = (keyFor, details) => {
      const groups = new Map()
      for (const row of selectedRows) {
        const key = keyFor(row)
        const item = groups.get(key) ?? []
        item.push(row)
        groups.set(key, item)
      }
      return [...groups.entries()].map(([key, rows]) => ({ key, ...details(rows[0]), ...summarize(rows) }))
    }
    const classes = group((row) => row.classKey, (row) => ({ classKey: row.classKey, classLabel: row.classLabel }))
    const seasons = group((row) => `${row.seasonId}:${row.classKey}`, (row) => ({
      seasonId: row.seasonId, season: row.season, classKey: row.classKey, classLabel: row.classLabel,
      championshipPosition: rankFor(row.seasonId, row.classKey),
    })).map((item) => {
      const rows = selectedRows.filter((row) => `${row.seasonId}:${row.classKey}` === item.key)
      const pointsByEvent = new Map(rows.map((row) => [row.eventId, Number(row.points) || 0]))
      const drops = selectGtDropWeeks(
        completedEventData.results.filter((event) => event.seasonId === item.seasonId),
        pointsByEvent,
        rows[0]?.dropWeeks,
        rows[0]?.dropStartRound,
      )
      return { ...item, points: Number(item.points) - drops.reduce((total, drop) => total + drop.points, 0) }
    }).sort((a, b) => b.season.localeCompare(a.season, undefined, { numeric: true }))
    const tracks = group((row) => canonicalGtTrackName(row.track), (row) => ({ track: canonicalGtTrackName(row.track) }))
      .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.starts - a.starts || a.track.localeCompare(b.track))
    const summary = summarize(selectedRows)
    return json({
      driverKey,
      driver: selectedRows.reduce((name, row) => preferredDriverName(name, row.driver), ''),
      ...summary,
      championships: seasons.filter((item) => item.championshipPosition === 1).length,
      seasonsEntered: new Set(selectedRows.map((row) => row.seasonId)).size,
      classes: classes.sort((a, b) => b.starts - a.starts),
      seasons,
      tracks: tracks.slice(0, 5),
      cars: [...new Set(selectedRows.map((row) => row.car).filter(Boolean))],
      teams: [...new Set(selectedRows.map((row) => row.team).filter(Boolean))],
    })
  }
  const requestedSeason = url.searchParams.get('season')
  const season = requestedSeason
    ? await db.prepare("SELECT id,name,status,race_time AS raceTime,timezone,drop_weeks AS dropWeeks,drop_start_round AS dropStartRound FROM gt_seasons WHERE id=? AND status<>'draft' LIMIT 1").bind(requestedSeason).first()
    : await db.prepare("SELECT id,name,status,race_time AS raceTime,timezone,drop_weeks AS dropWeeks,drop_start_round AS dropStartRound FROM gt_seasons WHERE status='active' LIMIT 1").first()
  if (!season) return json({ error: requestedSeason ? 'That GT season is not publicly available.' : 'No active in-house GT season.' }, 404)
  const [classData, eventData, resultData] = await Promise.all([
    db.prepare('SELECT class_key AS key,label,sort_order AS sortOrder FROM gt_season_classes WHERE season_id=? ORDER BY sort_order').bind(season.id).all(),
    db
      .prepare(
        'SELECT id,round_number AS round,race_date AS date,track,track_config AS trackConfig,laps,race_format AS format,status,subsession_id AS subsessionId FROM gt_events WHERE season_id=? ORDER BY round_number',
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
  const seasonClasses = classData.results.length
    ? classData.results
    : defaultClasses.map((key, index) => ({ key, label: defaultLabels[key], sortOrder: index + 1 }))
  const classes = seasonClasses.map((item) => item.key)
  const labels = Object.fromEntries(seasonClasses.map((item) => [item.key, item.label]))
  const rows = resultData.results.map((row) => ({ ...row, car_name: canonicalGtCarName(row.car_name) }))
  const standings = {}
  const teamStandings = {}
  const eventRounds = new Map(eventData.results.map((event) => [event.id, Number(event.round)]))
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
          team: row.team_name || '—',
          latestRound: 0,
          points: 0,
          starts: 0,
          wins: 0,
          podiums: 0,
          secondPlaces: 0,
          poles: 0,
          finalRaceFinish: Number.POSITIVE_INFINITY,
        }
        const rowRound = eventRounds.get(row.event_id) ?? 0
        if (rowRound >= item.latestRound) {
          item.car = row.car_name
          item.team = row.team_name || '—'
          item.latestRound = rowRound
        }
        item.points += row.total_points
        item.starts += 1
        item.wins += row.class_position === 1 ? 1 : 0
        item.podiums += row.class_position <= 3 ? 1 : 0
        item.secondPlaces += row.class_position === 2 ? 1 : 0
        item.poles += Number(row.pole) ? 1 : 0
        if (rowRound >= item.latestRound) item.finalRaceFinish = Number(row.class_position)
        aggregate.set(key, item)
        if (row.team_name) {
          const team = teams.get(row.team_name) ?? {
            driver: row.team_name,
            car: row.car_name,
            points: 0,
            starts: 0,
            wins: 0,
            podiums: 0,
            secondPlaces: 0,
            poles: 0,
            finalRaceFinish: Number.POSITIVE_INFINITY,
            latestRound: 0,
            drivers: '',
          }
          team.points += row.total_points
          team.starts += 1
          team.wins += row.class_position === 1 ? 1 : 0
          team.podiums += row.class_position <= 3 ? 1 : 0
          team.secondPlaces += row.class_position === 2 ? 1 : 0
          team.poles += Number(row.pole) ? 1 : 0
          if (rowRound >= team.latestRound) {
            team.latestRound = rowRound
            team.finalRaceFinish = Number(row.class_position)
          }
          const teamDrivers = team.drivers ? team.drivers.split(', ') : []
          if (!teamDrivers.includes(row.driver_name)) team.drivers = [...teamDrivers, row.driver_name].sort().join(', ')
          teams.set(row.team_name, team)
        }
      })
    const rank = (items) =>
      [...items.values()]
        .sort(compareGtStandings)
        .map(({ latestRound: _latestRound, secondPlaces: _secondPlaces, poles: _poles, finalRaceFinish: _finalRaceFinish, ...item }, index) => ({ rank: index + 1, ...item }))
    applyDriverDrops(aggregate, rows.filter((row) => row.class_key === classKey), eventData.results.filter((event) => event.status === 'completed'), season)
    for (const [teamName, team] of teams) {
      const pointsByEvent = new Map()
      for (const row of rows.filter((item) => item.class_key === classKey && item.team_name === teamName))
        pointsByEvent.set(row.event_id, (pointsByEvent.get(row.event_id) || 0) + (Number(row.total_points) || 0))
      const selected = selectGtDropWeeks(eventData.results.filter((event) => event.status === 'completed'), pointsByEvent, season.dropWeeks, season.dropStartRound)
      team.points -= selected.reduce((total, event) => total + event.points, 0)
    }
    standings[classKey] = rank(aggregate)
    teamStandings[classKey] = rank(teams)
  }
  const schedule = eventData.results.map((event) => {
    const eventRows = rows.filter((row) => row.event_id === event.id)
    const winner = (key) =>
      eventRows.find((row) => row.class_key === key && row.class_position === 1)?.driver_name || '—'
    return {
      eventId: event.id,
      round: event.round,
      date: event.date,
      track: canonicalGtTrackName(event.track),
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
      sourceEventId: event.id,
      label: `${canonicalGtTrackName(event.track)} — ${event.date}`,
      sessions: [
        {
          id: (event.subsessionId ?? event.round) * 10,
          label: 'Overall',
          rows: (() => {
            const eventRows = rows
              .filter((row) => row.event_id === event.id)
              .sort((a, b) => Number(a.overall_position) - Number(b.overall_position))
            const leader = eventRows.find((row) => Number(row.overall_position) === 1)
            return eventRows.map((row) => ({
              position: row.overall_position,
              podiumPosition: row.class_position,
              driver: row.driver_name,
              class: labels[row.class_key] ?? row.class_key,
              car: row.car_name,
              start: row.start_position,
              interval: formatOverallInterval(row, leader),
              laps: row.laps_completed,
              led: row.laps_led,
              racePoints: row.base_points,
              bonus: row.bonus_points,
              penalty: row.penalty_points,
              total: row.total_points,
              incidents: row.incidents,
              status: row.status,
              pole: row.pole,
              fastestLap: row.fastest_lap ? 1 : 0,
            }))
          })(),
        },
        ...classes.map((classKey, index) => {
        const classRows = rows.filter(
          (row) => row.event_id === event.id && row.class_key === classKey,
        )
        const leader = classRows.find((row) => row.class_position === 1)
        return {
          id: (event.subsessionId ?? event.round) * 10 + index + 1,
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
            fastestLap: row.fastest_lap ? 1 : 0,
          })),
        }
        }),
      ],
    }))
  return json({ season, classes: seasonClasses, schedule, standings, teamStandings, events, source: 'in-house' })
}
