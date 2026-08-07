import type { GtImportPreview, GtImportedDriver } from '../types/gtAdmin'

type UnknownRecord = Record<string, unknown>
const record = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const first = (source: UnknownRecord, keys: string[]) =>
  keys.map((key) => source[key]).find((value) => value !== undefined && value !== null)

function recordsIn(value: unknown, limit = 10000) {
  const found: UnknownRecord[] = []
  const queue: unknown[] = [value]
  const seen = new Set<object>()
  while (queue.length && found.length < limit) {
    const current = queue.shift()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    if (Array.isArray(current)) queue.push(...current)
    else {
      const item = record(current)
      found.push(item)
      queue.push(...Object.values(item))
    }
  }
  return found
}

const resultArray = (value: unknown) => {
  const rows = list(value)
  return rows.length &&
    rows.some(
      (item) =>
        first(record(item), ['display_name', 'driver_name', 'name', 'driver', 'cust_id']) !==
          undefined &&
        first(record(item), ['finish_position', 'finish_pos', 'position', 'pos']) !== undefined,
    )
    ? rows
    : []
}

export function parseGtResultJson(payload: unknown): GtImportPreview {
  const root = record(payload)
  const records = recordsIn(root)
  const sessions = records.flatMap((item) =>
    list(first(item, ['session_results', 'sessionResults', 'sessions'])).map(record),
  )
  const race =
    sessions.find(
      (item) =>
        text(first(item, ['simsession_name', 'session_name', 'name'])).toLowerCase() === 'race',
    ) ??
    [...sessions].reverse().find((item) => resultArray(first(item, ['results', 'rows'])).length)
  const direct = records
    .map((item) =>
      first(item, ['results', 'race_results', 'raceResults', 'result_rows', 'resultRows']),
    )
    .find((value) => resultArray(value).length)
  const discovered = records
    .flatMap((item) => Object.values(item))
    .find((value) => resultArray(value).length)
  const rows =
    [
      resultArray(first(race ?? {}, ['results', 'rows'])),
      resultArray(direct),
      resultArray(discovered),
    ].find((items) => items.length) ?? []
  if (!rows.length) throw new Error('No race result rows were found in this JSON file.')
  const drivers: GtImportedDriver[] = rows
    .map(record)
    .map((row, index) => ({
      customerId: number(first(row, ['cust_id', 'customer_id', 'customerId'])) || undefined,
      driver: text(first(row, ['display_name', 'driver_name', 'name', 'driver'])),
      overallPosition:
        number(first(row, ['finish_position', 'finish_pos', 'position', 'pos'])) +
          (row.finish_position !== undefined ? 1 : 0) || index + 1,
      start:
        number(first(row, ['starting_position', 'start_position', 'qualify_position', 'start'])) +
          (row.starting_position !== undefined ? 1 : 0) || 0,
      // iRacing replaces intervals with -1 once a car is down a lap to its built-in class
      // leader. Average lap multiplied by completed laps preserves cumulative race time, which
      // lets GRR calculate same-lap gaps independently for AM, Pro, and GTP.
      interval:
        text(
          number(first(row, ['average_lap', 'averageLap'])) *
            number(first(row, ['laps_complete', 'laps_completed', 'laps'])) ||
            first(row, ['class_interval', 'classInterval', 'interval', 'gap']),
        ) || '-',
      laps: number(first(row, ['laps_complete', 'laps_completed', 'laps'])),
      lapsLed: number(first(row, ['laps_lead', 'laps_led'])),
      incidents: number(first(row, ['incidents', 'inc_points', 'incident_points'])),
      status: text(first(row, ['reason_out', 'status'])) || 'Running',
      bestLapTime: number(
        first(row, ['best_lap_time', 'fastest_lap_time', 'fast_lap_time', 'bestLapTime']),
      ),
      car: text(first(row, ['car_name', 'car', 'car_screen_name', 'car_name_abbreviated'])),
    }))
    .filter((driver) => driver.driver)
    .sort((a, b) => a.overallPosition - b.overallPosition)
  const metadata = records.find((item) => first(item, ['subsession_id', 'subsessionId'])) ?? root
  const track = record(
    records.map((item) => first(item, ['track', 'track_info', 'trackInfo'])).find(Boolean),
  )
  const weekend = record(
    records.map((item) => first(item, ['weekend_info', 'weekendInfo'])).find(Boolean),
  )
  const subsessionId = number(first(metadata, ['subsession_id', 'subsessionId'])) || undefined
  const trackName = text(
    first(track, ['track_name', 'name']) ??
      records.map((item) => first(item, ['track_name', 'trackName'])).find(Boolean),
  )
  const warnings: string[] = []
  if (!subsessionId) warnings.push('No iRacing subsession ID was found.')
  if (!trackName) warnings.push('No track name was found; verify the scheduled event carefully.')
  return {
    subsessionId,
    track: trackName || 'Unknown track',
    raceDate: text(
      first(weekend, ['start_time', 'startTime']) ?? first(race ?? {}, ['start_time']),
    ),
    drivers,
    warnings,
  }
}
