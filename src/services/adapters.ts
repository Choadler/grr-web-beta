import type { DataResult, TableRow } from '../types/league'

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
