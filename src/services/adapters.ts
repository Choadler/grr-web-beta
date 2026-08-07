import type { DataResult, RaceEvent, RaceEventsResult, TableRow } from '../types/league'
import type { ScheduledRace } from '../config/schedules'
import { easternRaceTime, normalizeScheduleDate } from '../utils/raceTime'

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const record = (value: unknown) => (isRecord(value) ? value : {})
const list = (value: unknown) =>
  Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : []
const first = (source: UnknownRecord, keys: string[]) =>
  keys.map((key) => source[key]).find((value) => value !== undefined && value !== null)
const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => {
  const match = text(value)
    .replaceAll(',', '')
    .match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}
const driverName = (value: unknown) => {
  const name = text(value)
  if (!name.includes(',')) return name
  const [last, ...rest] = name.split(',')
  return `${rest.join(',').trim()} ${last.trim()}`.trim()
}

function requireRows(rows: TableRow[], label: string): DataResult {
  if (!Array.isArray(rows)) throw new Error(`${label} returned an unexpected response.`)
  return { rows }
}

export function adaptGtStandings(payload: unknown): DataResult {
  const root = record(payload)
  const source = list(first(root, ['standings', 'rows', 'data']) ?? payload)
  const rows = source
    .map((value, index) => {
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
    })
    .filter((row) => row.driver)
    .sort((a, b) => a.rank - b.rank)
  return { ...requireRows(rows, 'GT standings'), updated: text(first(root, ['updated', 'note'])) }
}

export function adaptSimRacerStandings(payload: unknown): DataResult {
  const root = record(payload)
  const source = list(root.rps)
  const rows = source
    .map((value, index) => {
      const row = record(value)
      const id = text(first(row, ['drid', 'driver_id']))
      return {
        rank: number(first(row, ['pos2', 'pos', 'rank'])) || index + 1,
        driver: driverName(first(row, ['name', 'driver'])),
        points: number(first(row, ['tpts', 'points', 'pts'])),
        starts: number(row.starts),
        wins: number(row.wins),
        stageWins: number(row.swins),
        poles: number(row.poles),
        top5: number(row.t5),
        top10: number(row.t10),
        lapsLed: number(row.led),
        rating: number(row.rat),
        link: id
          ? `https://www.simracerhub.com/scoring/driver_stats.php?driver_id=${encodeURIComponent(id)}`
          : '',
      }
    })
    .filter((row) => row.driver)
    .sort((a, b) => a.rank - b.rank)
  const sixteenth = rows.find((row) => row.rank === 16)?.points ?? 0
  const seventeenth = rows.find((row) => row.rank === 17)?.points ?? sixteenth
  const rowsWithCutoff = rows.map((row) => {
    const difference = row.points - (row.rank <= 16 ? seventeenth : sixteenth)
    return {
      ...row,
      cutoff: `${difference >= 0 ? '+' : ''}${difference}`,
      chase: row.rank <= 16 ? 'IN' : '—',
    }
  })
  const season = record(root.lss)
  return {
    ...requireRows(rowsWithCutoff, 'SimRacerHub standings'),
    label: text(season.season_name),
    updated: text(first(root, ['updated', 'note'])),
  }
}

export function adaptGtSchedule(payload: unknown): DataResult {
  const root = record(payload)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const rows = list(first(root, ['races', 'schedule', 'data']))
    .map((value, index) => {
      const row = record(value)
      const classes = list(row.classes).map((classValue) => record(classValue))
      const winner = (className: string) => {
        const classObject = classes.find((item) => text(item.class) === className)
        const firstPlace = list(classObject?.entries)
          .map((entry) => record(entry))
          .find((entry) => number(entry.class_position) === 1)
        return driverName(firstPlace?.driver)
      }
      const am = winner('GT3 AM')
      const pro = winner('GT3 PRO')
      const gtp = winner('GTP')
      const parsed = Date.parse(text(row.date_text))
      const iso = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : ''
      return {
        round: number(first(row, ['race_number', 'round'])) || index + 1,
        date: text(first(row, ['date_text', 'date'])),
        track: text(first(row, ['track_name', 'track'])),
        am: am || '—',
        pro: pro || '—',
        gtp: gtp || '—',
        state: am || pro || gtp || (iso && iso < today) ? 'done' : 'upcoming',
      }
    })
    .filter((row) => row.track)
  const nextIndex = rows.findIndex((row) => row.state === 'upcoming')
  if (nextIndex >= 0) rows[nextIndex] = { ...rows[nextIndex], state: 'next' }
  const next = nextIndex >= 0 ? rows[nextIndex] : null
  return {
    ...requireRows(rows, 'GT schedule'),
    label: next ? `Next: ${next.date || 'TBD'} — ${next.track || 'TBD'}` : `Races: ${rows.length}`,
  }
}

export function adaptGtResults(payload: unknown, classKey: string): DataResult {
  const root = record(payload)
  const races = list(first(root, ['races', 'data']))
  const latest = record(races[0])
  const classes = record(latest.classes)
  const classRows = list(
    classes[classKey] ?? classes[classKey.toUpperCase()] ?? first(latest, ['results', classKey]),
  )
  const rows = classRows
    .map((value, index) => {
      const row = record(value)
      return {
        position: number(first(row, ['class_pos', 'position', 'pos'])) || index + 1,
        driver: driverName(first(row, ['driver', 'name'])),
        points: number(first(row, ['points', 'pts', 'total_points'])),
      }
    })
    .filter((row) => row.driver)
  return {
    ...requireRows(rows, 'GT results'),
    label: text(first(latest, ['track_name', 'track'])),
    updated: text(first(root, ['updated', 'note'])),
  }
}

export function adaptRecentResults(payload: unknown): DataResult {
  const root = record(payload)
  const rows = list(first(root, ['results', 'races', 'data']))
    .map((value, index) => {
      const row = record(value)
      const podium = record(row.podium)
      return {
        position: index + 1,
        track: text(first(row, ['track', 'track_name'])),
        date: text(first(row, ['date_text', 'date'])),
        winner: driverName(first(podium, ['p1']) ?? first(row, ['winner', 'driver'])),
        scheduleId: text(row.schedule_id),
      }
    })
    .filter((row) => row.track)
  return requireRows(rows, 'Recent results')
}

function simRacerDrivers(payload: unknown) {
  return list(record(payload).rps).map((value) => record(value))
}

function mainRaceIds(drivers: UnknownRecord[]) {
  const ids = new Set<number>()
  drivers.forEach((driver) =>
    list(driver.races).forEach((value) => {
      const race = record(value)
      if (
        text(race.session).toUpperCase() === 'RACE' &&
        text(race.count_stats).toUpperCase() === 'Y'
      )
        ids.add(number(race.race_id))
    }),
  )
  return [...ids].filter(Boolean).sort((a, b) => a - b)
}

export function adaptSimRacerSchedule(
  payload: unknown,
  schedule: ScheduledRace[],
  includeExhibition = false,
): DataResult {
  const drivers = simRacerDrivers(payload)
  const ids = mainRaceIds(drivers)
  let exhibitionId = 0
  if (includeExhibition && ids.length) {
    drivers.forEach((driver) =>
      list(driver.races).forEach((value) => {
        const race = record(value)
        const id = number(race.race_id)
        if (
          text(race.session).toUpperCase() === 'RACE' &&
          text(race.count_stats).toUpperCase() !== 'Y' &&
          id < ids[0]
        )
          exhibitionId = Math.max(exhibitionId, id)
      }),
    )
  }
  const raceIds = includeExhibition ? [exhibitionId, ...ids] : ids
  const rows = schedule.map((event, index) => {
    const raceId = raceIds[index]
    let winner = ''
    let pole = ''
    drivers.forEach((driver) => {
      const race = record(record(driver.races)[String(raceId)])
      if (number(race.finish_pos) === 1) winner = driverName(driver.name)
      if (number(race.qualify_pos) === 1) pole = driverName(driver.name)
    })
    return {
      round: event.round,
      date: event.date,
      track: event.track,
      type: event.type ?? '',
      laps: event.laps ?? '',
      winner: winner || '—',
      pole: pole || '—',
    }
  })
  return { rows, label: text(record(record(payload).lss).season_name) }
}

export function adaptSimRacerLatestResults(payload: unknown): DataResult {
  const drivers = simRacerDrivers(payload)
  const raceId = mainRaceIds(drivers).at(-1)
  if (!raceId) return { rows: [] }
  const rows = drivers
    .map((driver) => {
      const race = record(record(driver.races)[String(raceId)])
      if (!Object.keys(race).length) return null
      return {
        position: number(race.finish_pos),
        driver: driverName(driver.name),
        start: number(race.qualify_pos),
        interval:
          text(
            first(race, ['interval', 'gap', 'time_interval', 'interval_time', 'finish_interval']),
          ) || '—',
        laps: number(race.num_laps),
        led: number(race.laps_led),
        racePoints: number(race.race_points),
        stagePoints: number(race.stage_points),
        bonus: number(race.bonus_points),
        penalty: number(race.penalty_points),
        total: number(race.total_points),
        incidents: number(race.incidents),
        status: text(race.status) || '—',
        passes: text(race.passes) || '—',
        quality: text(race.quality_passes) || '—',
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.position - b.position)
  const sample = rows.length
    ? drivers
        .map((driver) => record(record(driver.races)[String(raceId)]))
        .find((race) => Object.keys(race).length)
    : {}
  return {
    rows,
    label:
      text(first(record(sample), ['track_name', 'race_name', 'event_name'])) || `Race ${raceId}`,
  }
}

function detailedRows(drivers: UnknownRecord[], sessionId: number, stage = false): TableRow[] {
  const rows: TableRow[] = []
  const fastestDriver = drivers
    .map((driver) => ({ driver, race: record(record(driver.races)[String(sessionId)]) }))
    .filter(
      ({ race }) => number(first(race, ['fastest_lap_time', 'fast_lap_time', 'best_lap_time'])) > 0,
    )
    .sort(
      (left, right) =>
        number(first(left.race, ['fastest_lap_time', 'fast_lap_time', 'best_lap_time'])) -
          number(first(right.race, ['fastest_lap_time', 'fast_lap_time', 'best_lap_time'])) ||
        number(left.race.finish_pos) - number(right.race.finish_pos),
    )[0]?.driver
  drivers.forEach((driver) => {
    const race = record(record(driver.races)[String(sessionId)])
    if (!Object.keys(race).length) return
    if (stage) {
      const position = number(race.finish_pos)
      rows.push({
        position,
        driver: driverName(driver.name),
        stagePoints: Math.max(0, 11 - position),
      })
      return
    }
    rows.push({
      position: number(race.finish_pos),
      driver: driverName(driver.name),
      start: number(race.qualify_pos),
      interval:
        text(
          first(race, ['interval', 'gap', 'time_interval', 'interval_time', 'finish_interval']),
        ) || '—',
      laps: number(race.num_laps),
      led: number(race.laps_led),
      racePoints: number(race.race_points),
      stagePoints: number(race.stage_points),
      bonus: number(race.bonus_points),
      penalty: number(race.penalty_points),
      total: number(race.total_points),
      incidents: number(race.incidents),
      status: text(race.status) || '—',
      passes: text(race.passes) || '—',
      quality: text(race.quality_passes) || '—',
      fastestLap: fastestDriver === driver ? 1 : 0,
    })
  })
  return rows.sort((a, b) => number(a.position) - number(b.position))
}

export function adaptSimRacerEvents(
  payload: unknown,
  schedule: ScheduledRace[],
  includeStages = false,
): RaceEventsResult {
  const drivers = simRacerDrivers(payload)
  const ids = mainRaceIds(drivers)
  const events: RaceEvent[] = ids.map((raceId, index) => {
    const scheduled = schedule[index + (schedule[0]?.round === 0 ? 1 : 0)]
    const previousId = ids[index - 1] ?? 0
    const stageIds = new Set<number>()
    if (includeStages)
      drivers.forEach((driver) =>
        list(driver.races).forEach((value) => {
          const race = record(value)
          const id = number(race.race_id)
          if (id > previousId && id < raceId && text(race.session).toUpperCase() === 'SEGMENT')
            stageIds.add(id)
        }),
      )
    const stageSessions = [...stageIds]
      .sort((a, b) => a - b)
      .map((id, stageIndex) => ({
        id,
        label: `Stage ${stageIndex + 1}`,
        rows: detailedRows(drivers, id, true),
      }))
    const stageTotals = new Map<string, number>()
    stageSessions.forEach((session) =>
      session.rows.forEach((row) =>
        stageTotals.set(
          String(row.driver),
          (stageTotals.get(String(row.driver)) ?? 0) + number(row.stagePoints),
        ),
      ),
    )
    const overallRows = detailedRows(drivers, raceId).map((row) => {
      const stagePoints = stageTotals.get(String(row.driver)) ?? 0
      return { ...row, stagePoints, total: number(row.total) + stagePoints }
    })
    const sessions = [
      { id: raceId, label: 'Overall Race Finish', rows: overallRows },
      ...stageSessions,
    ]
    return {
      id: raceId,
      label: scheduled
        ? `${scheduled.track} — ${scheduled.date}`
        : `Round ${index + 1} — Race ${raceId}`,
      sessions,
    }
  })
  return {
    events,
    season: text(record(record(payload).lss).season_name) || text(record(payload).season_name),
  }
}

export function adaptGtRaceEvents(payload: unknown): RaceEventsResult {
  const root = record(payload)
  if (root.ok === false) throw new Error(text(root.error) || 'GT results returned an error.')
  const races = list(root.races)
    .map((value) => record(value))
    .filter((race) => {
      const startsAt = easternRaceTime(normalizeScheduleDate(text(race.date_text)))
      const hasResults = list(race.classes).some((classValue) =>
        list(record(classValue).entries).some((entry) => number(record(entry).class_position) > 0),
      )
      return Number.isFinite(startsAt) ? startsAt <= Date.now() : hasResults
    })
    .sort(
      (a, b) =>
        number(a.race_number) - number(b.race_number) ||
        text(a.race_type).localeCompare(text(b.race_type)),
    )
  const events: RaceEvent[] = races.map((race, raceIndex) => {
    const classSessions = list(race.classes).map((value, classIndex) => {
      const classObject = record(value)
      const entries = list(classObject.entries).map((entryValue) => record(entryValue))
      const fastest = entries
        .filter((entry) =>
          ['true', '1', 'yes', 'y', 'checked'].includes(text(entry.fastest_lap).toLowerCase()),
        )
        .sort(
          (a, b) =>
            number(a.class_position) - number(b.class_position) ||
            number(a.overall_position) - number(b.overall_position),
        )[0]
      const fastestDriver = text(fastest?.driver)
      const rows = entries
        .map((entry) => ({
          position: number(entry.class_position),
          overallPosition: number(entry.overall_position),
          driver: driverName(entry.driver),
          class: text(classObject.class),
          points: number(entry.points),
          fastestLap: fastestDriver && text(entry.driver) === fastestDriver ? 1 : 0,
        }))
        .sort((a, b) => a.position - b.position)
      return { id: raceIndex * 10 + classIndex + 1, label: text(classObject.class), rows }
    })
    const overallRows = classSessions
      .flatMap((session) =>
        session.rows.map((row) => ({
          ...row,
          podiumPosition: row.position,
          position: row.overallPosition,
        })),
      )
      .filter((row) => row.position > 0)
      .sort((a, b) => a.position - b.position)
    const sessions = [
      { id: raceIndex * 10, label: 'Overall', rows: overallRows },
      ...classSessions,
    ]
    const week = text(race.race_number) ? `Week ${text(race.race_number)}` : 'Week'
    const label = [week, text(race.track_name) || 'Race', text(race.date_text)]
      .filter(Boolean)
      .join(' — ')
    return { id: raceIndex + 1, label, sessions }
  })
  return { events, defaultEventIndex: Math.max(0, events.length - 1) }
}
