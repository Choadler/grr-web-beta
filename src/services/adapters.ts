import type { DataResult, RaceEvent, RaceEventsResult, TableRow } from '../types/league'
import type { ScheduledRace } from '../config/schedules'

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const record = (value: unknown) => (isRecord(value) ? value : {})
const list = (value: unknown) => Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : []
const first = (source: UnknownRecord, keys: string[]) => keys.map((key) => source[key]).find((value) => value !== undefined && value !== null)
const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => { const match = text(value).replaceAll(',', '').match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : 0 }
const driverName = (value: unknown) => { const name = text(value); if (!name.includes(',')) return name; const [last, ...rest] = name.split(','); return `${rest.join(',').trim()} ${last.trim()}`.trim() }

function requireRows(rows: TableRow[], label: string): DataResult {
  if (!Array.isArray(rows)) throw new Error(`${label} returned an unexpected response.`)
  return { rows }
}

export function adaptGtStandings(payload: unknown): DataResult {
  const root = record(payload)
  const source = list(first(root, ['standings', 'rows', 'data']) ?? payload)
  const rows = source.map((value, index) => {
    const row = record(value)
    return {
      rank: number(first(row, ['rank', 'pos', 'position'])) || index + 1,
      driver: driverName(first(row, ['driver', 'name', 'team'])),
      car: text(first(row, ['car', 'vehicle'])),
      starts: number(first(row, ['races', 'starts', 'race_starts', 'raceStarts'])),
      points: number(first(row, ['points', 'pts'])),
      wins: number(row.wins),
      podiums: number(first(row, ['podiums', 'pods'])),
    }
  }).filter((row) => row.driver).sort((a, b) => a.rank - b.rank)
  return { ...requireRows(rows, 'GT standings'), updated: text(first(root, ['updated', 'note'])) }
}

export function adaptSimRacerStandings(payload: unknown): DataResult {
  const root = record(payload)
  const source = list(root.rps)
  const rows = source.map((value, index) => {
    const row = record(value)
    const id = text(first(row, ['drid', 'driver_id']))
    return {
      rank: number(first(row, ['pos2', 'pos', 'rank'])) || index + 1,
      driver: driverName(first(row, ['name', 'driver'])),
      points: number(first(row, ['tpts', 'points', 'pts'])),
      starts: number(row.starts), wins: number(row.wins), stageWins: number(row.swins),
      poles: number(row.poles), top5: number(row.t5), top10: number(row.t10),
      lapsLed: number(row.led), rating: number(row.rat),
      link: id ? `https://www.simracerhub.com/scoring/driver_stats.php?driver_id=${encodeURIComponent(id)}` : '',
    }
  }).filter((row) => row.driver).sort((a, b) => a.rank - b.rank)
  const season = record(root.lss)
  return { ...requireRows(rows, 'SimRacerHub standings'), label: text(season.season_name), updated: text(first(root, ['updated', 'note'])) }
}

export function adaptGtSchedule(payload: unknown): DataResult {
  const root = record(payload)
  const rows = list(first(root, ['races', 'schedule', 'data'])).map((value, index) => {
    const row = record(value)
    return {
      round: number(first(row, ['race_number', 'round'])) || index + 1,
      date: text(first(row, ['date_text', 'date'])), track: text(first(row, ['track_name', 'track'])),
      am: text(first(row, ['am', 'gt3_am_winner'])), pro: text(first(row, ['pro', 'gt3_pro_winner'])),
      gtp: text(first(row, ['gtp', 'gtp_winner'])),
    }
  }).filter((row) => row.track)
  return { ...requireRows(rows, 'GT schedule'), updated: text(first(root, ['updated', 'note'])) }
}

export function adaptGtResults(payload: unknown, classKey: string): DataResult {
  const root = record(payload)
  const races = list(first(root, ['races', 'data']))
  const latest = record(races[0])
  const classes = record(latest.classes)
  const classRows = list(classes[classKey] ?? classes[classKey.toUpperCase()] ?? first(latest, ['results', classKey]))
  const rows = classRows.map((value, index) => {
    const row = record(value)
    return { position: number(first(row, ['class_pos', 'position', 'pos'])) || index + 1, driver: driverName(first(row, ['driver', 'name'])), points: number(first(row, ['points', 'pts', 'total_points'])) }
  }).filter((row) => row.driver)
  return { ...requireRows(rows, 'GT results'), label: text(first(latest, ['track_name', 'track'])), updated: text(first(root, ['updated', 'note'])) }
}

export function adaptRecentResults(payload: unknown): DataResult {
  const root = record(payload)
  const rows = list(first(root, ['results', 'races', 'data'])).map((value, index) => {
    const row = record(value); const podium = record(row.podium)
    return { position: index + 1, track: text(first(row, ['track', 'track_name'])), date: text(first(row, ['date_text', 'date'])), winner: driverName(first(podium, ['p1']) ?? first(row, ['winner', 'driver'])), scheduleId: text(row.schedule_id) }
  }).filter((row) => row.track)
  return requireRows(rows, 'Recent results')
}

function simRacerDrivers(payload: unknown) {
  return list(record(payload).rps).map((value) => record(value))
}

function mainRaceIds(drivers: UnknownRecord[]) {
  const ids = new Set<number>()
  drivers.forEach((driver) => list(driver.races).forEach((value) => {
    const race = record(value)
    if (text(race.session).toUpperCase() === 'RACE' && text(race.count_stats).toUpperCase() === 'Y') ids.add(number(race.race_id))
  }))
  return [...ids].filter(Boolean).sort((a, b) => a - b)
}

export function adaptSimRacerSchedule(payload: unknown, schedule: ScheduledRace[], includeExhibition = false): DataResult {
  const drivers = simRacerDrivers(payload)
  const ids = mainRaceIds(drivers)
  let exhibitionId = 0
  if (includeExhibition && ids.length) {
    drivers.forEach((driver) => list(driver.races).forEach((value) => {
      const race = record(value); const id = number(race.race_id)
      if (text(race.session).toUpperCase() === 'RACE' && text(race.count_stats).toUpperCase() !== 'Y' && id < ids[0]) exhibitionId = Math.max(exhibitionId, id)
    }))
  }
  const raceIds = includeExhibition ? [exhibitionId, ...ids] : ids
  const rows = schedule.map((event, index) => {
    const raceId = raceIds[index]
    let winner = ''; let pole = ''
    drivers.forEach((driver) => {
      const race = record(record(driver.races)[String(raceId)])
      if (number(race.finish_pos) === 1) winner = driverName(driver.name)
      if (number(race.qualify_pos) === 1) pole = driverName(driver.name)
    })
    return { round: event.round, date: event.date, track: event.track, type: event.type ?? '', laps: event.laps ?? '', winner: winner || '—', pole: pole || '—' }
  })
  return { rows, label: text(record(record(payload).lss).season_name) }
}

export function adaptSimRacerLatestResults(payload: unknown): DataResult {
  const drivers = simRacerDrivers(payload)
  const raceId = mainRaceIds(drivers).at(-1)
  if (!raceId) return { rows: [] }
  const rows = drivers.map((driver) => {
    const race = record(record(driver.races)[String(raceId)])
    if (!Object.keys(race).length) return null
    return {
      position: number(race.finish_pos), driver: driverName(driver.name), start: number(race.qualify_pos),
      interval: text(first(race, ['interval', 'gap', 'time_interval', 'interval_time', 'finish_interval'])) || '—',
      laps: number(race.num_laps), led: number(race.laps_led), racePoints: number(race.race_points),
      stagePoints: number(race.stage_points), bonus: number(race.bonus_points), penalty: number(race.penalty_points),
      total: number(race.total_points), incidents: number(race.incidents), status: text(race.status) || '—',
      passes: text(race.passes) || '—', quality: text(race.quality_passes) || '—',
    }
  }).filter((row): row is NonNullable<typeof row> => Boolean(row)).sort((a, b) => a.position - b.position)
  const sample = rows.length ? drivers.map((driver) => record(record(driver.races)[String(raceId)])).find((race) => Object.keys(race).length) : {}
  return { rows, label: text(first(record(sample), ['track_name', 'race_name', 'event_name'])) || `Race ${raceId}` }
}

function detailedRows(drivers: UnknownRecord[], sessionId: number, stage = false): TableRow[] {
  const rows: TableRow[] = []
  drivers.forEach((driver) => {
    const race = record(record(driver.races)[String(sessionId)])
    if (!Object.keys(race).length) return
    if (stage) {
      rows.push({ position: number(race.finish_pos), driver: driverName(driver.name) })
      return
    }
    rows.push({
      position: number(race.finish_pos), driver: driverName(driver.name), start: number(race.qualify_pos),
      interval: text(first(race, ['interval', 'gap', 'time_interval', 'interval_time', 'finish_interval'])) || '—',
      laps: number(race.num_laps), led: number(race.laps_led), racePoints: number(race.race_points),
      stagePoints: number(race.stage_points), bonus: number(race.bonus_points), penalty: number(race.penalty_points),
      total: number(race.total_points), incidents: number(race.incidents), status: text(race.status) || '—',
      passes: text(race.passes) || '—', quality: text(race.quality_passes) || '—',
    })
  })
  return rows.sort((a, b) => number(a.position) - number(b.position))
}

export function adaptSimRacerEvents(payload: unknown, schedule: ScheduledRace[], includeStages = false): RaceEventsResult {
  const drivers = simRacerDrivers(payload)
  const ids = mainRaceIds(drivers)
  const events: RaceEvent[] = ids.map((raceId, index) => {
    const scheduled = schedule[index + (schedule[0]?.round === 0 ? 1 : 0)]
    const previousId = ids[index - 1] ?? 0
    const stageIds = new Set<number>()
    if (includeStages) drivers.forEach((driver) => list(driver.races).forEach((value) => {
      const race = record(value); const id = number(race.race_id)
      if (id > previousId && id < raceId && text(race.session).toUpperCase() === 'SEGMENT') stageIds.add(id)
    }))
    const sessions = [{ id: raceId, label: 'Overall Race Finish', rows: detailedRows(drivers, raceId) }]
    ;[...stageIds].sort((a, b) => a - b).forEach((id, stageIndex) => sessions.push({ id, label: `Stage ${stageIndex + 1}`, rows: detailedRows(drivers, id, true) }))
    return { id: raceId, label: scheduled ? `${scheduled.track} — ${scheduled.date}` : `Round ${index + 1} — Race ${raceId}`, sessions }
  })
  return { events, season: text(record(record(payload).lss).season_name) || text(record(payload).season_name) }
}
