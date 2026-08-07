import type {
  GtAdminState,
  GtClassKey,
  GtDriverAssignment,
  GtImportPreview,
  GtManagedResult,
  GtPointsConfig,
  GtRaceFormat,
  GtPublicData,
  GtScheduledEvent,
  GtSeason,
  GtTeam,
} from '../types/gtAdmin'
import { gtRoster, gtTeamRoster, normalizeGtDriverName } from '../config/gtRoster'

const endpoint = '/admin/api/gt'
const storageKey = 'grr-gt-admin-preview-v1'
export const gtClasses: { key: GtClassKey; label: string }[] = [
  { key: 'gt3-am', label: 'GT3 AM' },
  { key: 'gt3-pro', label: 'GT3 Pro' },
  { key: 'gtp', label: 'GTP' },
]
export const defaultGtPoints: GtPointsConfig = {
  positions: Array.from({ length: 40 }, (_, index) => ({ position: index + 1, points: 0 })),
  poleBonus: 0,
  fastestLapBonus: 0,
  lapLedBonus: 0,
  mostLapsLedBonus: 0,
}
export const emptyGtState: GtAdminState = {
  seasons: [],
  points: {},
  schedule: [],
  assignments: [],
  teams: [],
  results: {},
  imports: [],
}
const record = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
const localState = (): GtAdminState => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '') as Partial<GtAdminState>
    return { ...emptyGtState, ...saved, points: saved.points ?? {}, results: saved.results ?? {} }
  } catch {
    return structuredClone(emptyGtState)
  }
}
const saveLocal = (state: GtAdminState) => {
  localStorage.setItem(storageKey, JSON.stringify(state))
  return state
}

function withRaceFormats(state: GtAdminState): GtAdminState {
  const legacy = state.points as unknown as Record<string, Record<string, GtPointsConfig>>
  const points = Object.fromEntries(
    Object.entries(legacy).map(([seasonId, configs]) => {
      const fallback = configs.standard ?? configs['gt3-am'] ?? configs['gt3-pro'] ?? configs.gtp
      return [
        seasonId,
        {
          standard: configs.standard ?? structuredClone(fallback ?? defaultGtPoints),
          endurance: configs.endurance ?? structuredClone(fallback ?? defaultGtPoints),
        },
      ]
    }),
  ) as GtAdminState['points']
  return {
    ...state,
    points,
    schedule: state.schedule.map((event) => ({ ...event, format: event.format ?? 'standard' })),
  }
}

function withRoster(state: GtAdminState): GtAdminState {
  const assignments = [...state.assignments]
  state.seasons
    .filter((season) => season.status !== 'archived')
    .forEach((season) =>
      gtRoster.forEach((entry, index) => {
        if (
          !assignments.some(
            (item) =>
              item.seasonId === season.id &&
              normalizeGtDriverName(item.driver) === normalizeGtDriverName(entry.driver),
          )
        )
          assignments.push({
            seasonId: season.id,
            customerId: -(index + 1),
            driver: entry.driver,
            classKey: entry.classKey,
            team: '',
            car: entry.car,
          })
      }),
    )
  const chosen = new Map<string, GtDriverAssignment>()
  assignments.forEach((item) => {
    const key = `${item.seasonId}:${normalizeGtDriverName(item.driver)}`
    const current = chosen.get(key)
    if (!current || (item.customerId > 0 && current.customerId < 0)) chosen.set(key, item)
  })
  const merged = [...chosen.values()]
  const teams = [...state.teams]
  state.seasons
    .filter((season) => season.status !== 'archived')
    .forEach((season) =>
      gtTeamRoster.forEach((entry) => {
        if (
          teams.some(
            (team) =>
              team.seasonId === season.id &&
              team.classKey === entry.classKey &&
              normalizeGtDriverName(team.name) === normalizeGtDriverName(entry.name),
          )
        )
          return
        const memberAssignments = entry.members.map(({ driver }) =>
          merged.find(
            (assignment) =>
              assignment.seasonId === season.id &&
              normalizeGtDriverName(assignment.driver) === normalizeGtDriverName(driver),
          ),
        )
        teams.push({
          id: `roster-${season.id}-${normalizeGtDriverName(entry.name).replace(/\s+/g, '-')}`,
          seasonId: season.id,
          name: entry.name,
          classKey: entry.classKey,
          car: entry.car,
          memberIds: memberAssignments.map((assignment) => assignment?.customerId ?? 0),
          memberNames: entry.members.map(({ driver }) => driver),
        })
      }),
    )
  teams.forEach((team) =>
    team.memberNames.forEach((name) => {
      const member = merged.find(
        (item) =>
          item.seasonId === team.seasonId &&
          normalizeGtDriverName(item.driver) === normalizeGtDriverName(name),
      )
      if (member) {
        member.team = team.name
        member.classKey = team.classKey
        member.car = team.car || member.car
      }
    }),
  )
  return { ...state, assignments: merged, teams }
}

function score(drivers: GtManagedResult[], config: GtPointsConfig) {
  return gtClasses.flatMap(({ key }) => {
    const rows = drivers
      .filter((driver) => driver.classKey === key)
      .sort((a, b) => a.overallPosition - b.overallPosition)
    const poleStart = Math.min(...rows.map((row) => row.start || 9999))
    const fastest = Math.min(...rows.map((row) => row.bestLapTime || Infinity))
    const mostLed = Math.max(0, ...rows.map((row) => row.lapsLed))
    return rows.map((driver, index) => {
      const classPosition = index + 1
      const pole = driver.start === poleStart
      const fastestLap = driver.bestLapTime > 0 && driver.bestLapTime === fastest
      const racePoints =
        config.positions.find((rule) => rule.position === classPosition)?.points ?? 0
      const bonus =
        (pole ? config.poleBonus : 0) +
        (fastestLap ? config.fastestLapBonus : 0) +
        (driver.lapsLed > 0 ? config.lapLedBonus : 0) +
        (mostLed > 0 && driver.lapsLed === mostLed ? config.mostLapsLedBonus : 0)
      const penalty = Math.max(0, driver.penalty || 0)
      return {
        ...driver,
        classPosition,
        pole,
        fastestLap,
        racePoints,
        bonus,
        penalty,
        total: racePoints + bonus - penalty,
      }
    })
  })
}

const intervalNumber = (value: string) => {
  const parsed = Number(value.replace(/^\+/, ''))
  return Number.isFinite(parsed) ? parsed : null
}
const classInterval = (row: GtManagedResult, leader: GtManagedResult | undefined) => {
  if (row.classPosition === 1) return '-'
  const down = Math.max(0, Number(leader?.laps) - row.laps)
  if (down) return `${down} Lap${down === 1 ? '' : 's'}`
  const value = intervalNumber(row.interval)
  const base = intervalNumber(leader?.interval ?? '')
  if (value === null || base === null || value <= base) return '-'
  return `+${((value - base) / 10000).toFixed(3)}`
}

async function request<T>(method: string, body?: unknown): Promise<T> {
  if (import.meta.env.DEV) {
    const state = structuredClone(localState())
    const data = record(body)
    const action = data.action
    if (method === 'GET') return state as T
    if (action === 'saveSeason') {
      const item = data.season as GtSeason
      if (item.status === 'active')
        state.seasons.forEach((season) => {
          if (season.id !== item.id) season.status = 'archived'
        })
      const index = state.seasons.findIndex((season) => season.id === item.id)
      if (index >= 0) state.seasons[index] = item
      else state.seasons.push(item)
      state.points[item.id] ??= {
        standard: structuredClone(defaultGtPoints),
        endurance: structuredClone(defaultGtPoints),
      }
    }
    if (action === 'savePoints') {
      const seasonId = String(data.seasonId)
      const format = String(data.format) as GtRaceFormat
      state.points[seasonId] ??= {} as Record<GtRaceFormat, GtPointsConfig>
      state.points[seasonId][format] = data.points as GtPointsConfig
      state.schedule
        .filter((event) => event.seasonId === seasonId && event.format === format)
        .forEach((event) => {
          const rows = state.results[event.id]
          if (rows?.length) state.results[event.id] = score(rows, state.points[seasonId][format])
        })
    }
    if (action === 'saveTeam') {
      const team = data.team as GtTeam
      const index = state.teams.findIndex((item) => item.id === team.id)
      if (index >= 0) state.teams[index] = team
      else state.teams.push(team)
      state.assignments.forEach((assignment) => {
        if (
          assignment.seasonId === team.seasonId &&
          (team.memberIds.includes(assignment.customerId) ||
            team.memberNames.some(
              (name) => normalizeGtDriverName(name) === normalizeGtDriverName(assignment.driver),
            ))
        ) {
          assignment.team = team.name
          assignment.classKey = team.classKey
          if (team.car) assignment.car = team.car
        }
      })
      Object.values(state.results)
        .flat()
        .forEach((result) => {
          if (team.memberIds.includes(result.customerId ?? 0)) {
            result.team = team.name
            result.classKey = team.classKey
            if (team.car) result.car = team.car
          }
        })
    }
    if (action === 'deleteTeam') {
      const team = state.teams.find((item) => item.id === data.teamId)
      state.teams = state.teams.filter((item) => item.id !== data.teamId)
      if (team)
        state.assignments.forEach((item) => {
          if (item.seasonId === team.seasonId && item.team === team.name) item.team = ''
        })
    }
    if (action === 'saveEvent') {
      const item = data.event as GtScheduledEvent
      const index = state.schedule.findIndex((event) => event.id === item.id)
      if (index >= 0) state.schedule[index] = item
      else state.schedule.push(item)
    }
    if (action === 'deleteEvent')
      state.schedule = state.schedule.filter((event) => event.id !== data.eventId)
    if (action === 'saveAssignment') {
      const item = data.assignment as GtDriverAssignment
      const index = state.assignments.findIndex(
        (assignment) =>
          assignment.seasonId === item.seasonId && assignment.customerId === item.customerId,
      )
      if (index >= 0) state.assignments[index] = item
      else state.assignments.push(item)
    }
    if (action === 'saveAssignments')
      (data.assignments as GtDriverAssignment[]).forEach((item) => {
        const index = state.assignments.findIndex(
          (assignment) =>
            assignment.seasonId === item.seasonId && assignment.customerId === item.customerId,
        )
        if (index >= 0) state.assignments[index] = item
        else state.assignments.push(item)
      })
    if (action === 'deleteAssignment')
      state.assignments = state.assignments.filter(
        (item) => !(item.seasonId === data.seasonId && item.customerId === data.customerId),
      )
    if (action === 'deleteResults') {
      const eventId = String(data.eventId)
      delete state.results[eventId]
      state.imports = state.imports.filter((item) => item.eventId !== eventId)
      const event = state.schedule.find((item) => item.id === eventId)
      if (event) {
        event.status = 'scheduled'
        event.subsessionId = undefined
      }
    }
    if (action === 'publishResults') {
      const eventId = String(data.eventId)
      const seasonId = String(data.seasonId)
      const preview = data.preview as GtImportPreview
      const event = state.schedule.find((item) => item.id === eventId)
      const results = score(
        data.drivers as GtManagedResult[],
        state.points[seasonId]?.[event?.format ?? 'standard'] ?? defaultGtPoints,
      )
      state.results[eventId] = results
      if (event) {
        event.status = 'completed'
        event.subsessionId = preview.subsessionId
      }
      state.imports = state.imports.filter((item) => item.eventId !== eventId)
      state.imports.push({
        id: crypto.randomUUID(),
        seasonId,
        eventId,
        subsessionId: preview.subsessionId,
        filename: String(data.filename),
        importedAt: new Date().toISOString(),
      })
      results.forEach((driver) => {
        if (!driver.customerId) return
        const assignment: GtDriverAssignment = {
          seasonId,
          customerId: driver.customerId,
          driver: driver.driver,
          classKey: driver.classKey,
          team: driver.team,
          car: driver.car,
        }
        const index = state.assignments.findIndex(
          (item) => item.seasonId === seasonId && item.customerId === driver.customerId,
        )
        if (index >= 0) state.assignments[index] = assignment
        else state.assignments.push(assignment)
      })
    }
    if (action === 'saveResults')
      state.results[String(data.eventId)] = (() => {
        const event = state.schedule.find((item) => item.id === data.eventId)
        return score(
          data.results as GtManagedResult[],
          state.points[event?.seasonId ?? '']?.[event?.format ?? 'standard'] ?? defaultGtPoints,
        )
      })()
    return saveLocal(state) as T
  }
  const response = await fetch(endpoint, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(
      String(record(payload).error || `GT admin request failed (${response.status}).`),
    )
  }
  return (await response.json()) as T
}

export const loadGtAdmin = async () =>
  withRoster(withRaceFormats(await request<GtAdminState>('GET')))
export const mutateGtAdmin = (body: unknown) => request<GtAdminState>('POST', body)

export function loadLocalGtPublic(): GtPublicData | null {
  if (!import.meta.env.DEV) return null
  const state = localState()
  const season = state.seasons.find((item) => item.status === 'active')
  if (!season) return null
  const seasonEvents = state.schedule
    .filter((item) => item.seasonId === season.id)
    .sort((a, b) => a.round - b.round)
  const rows = seasonEvents.flatMap((event) =>
    (state.results[event.id] ?? []).map((row) => ({ ...row, event })),
  )
  const standings = {} as GtPublicData['standings']
  const teamStandings = {} as GtPublicData['teamStandings']
  gtClasses.forEach(({ key }) => {
    const drivers = new Map<string, Record<string, string | number>>()
    const teams = new Map<string, Record<string, string | number>>()
    rows
      .filter((row) => row.classKey === key)
      .forEach((row) => {
        const driverKey = row.customerId ? `id:${row.customerId}` : row.driver
        const item = drivers.get(driverKey) ?? {
          driver: row.driver,
          car: row.car,
          points: 0,
          starts: 0,
          wins: 0,
          podiums: 0,
        }
        item.points = Number(item.points) + row.total
        item.starts = Number(item.starts) + 1
        item.wins = Number(item.wins) + (row.classPosition === 1 ? 1 : 0)
        item.podiums = Number(item.podiums) + (row.classPosition <= 3 ? 1 : 0)
        drivers.set(driverKey, item)
        if (row.team) {
          const team = teams.get(row.team) ?? {
            driver: row.team,
            car: row.car,
            points: 0,
            starts: 0,
            wins: 0,
            podiums: 0,
          }
          team.points = Number(team.points) + row.total
          team.starts = Number(team.starts) + 1
          team.wins = Number(team.wins) + (row.classPosition === 1 ? 1 : 0)
          team.podiums = Number(team.podiums) + (row.classPosition <= 3 ? 1 : 0)
          teams.set(row.team, team)
        }
      })
    const rank = (values: Map<string, Record<string, string | number>>) =>
      [...values.values()]
        .sort((a, b) => Number(b.points) - Number(a.points))
        .map((item, index) => ({ rank: index + 1, ...item }))
    standings[key] = rank(drivers)
    teamStandings[key] = rank(teams)
  })
  const schedule = seasonEvents.map((event) => {
    const results = rows.filter((row) => row.event.id === event.id)
    const winner = (key: GtClassKey) =>
      results.find((row) => row.classKey === key && row.classPosition === 1)?.driver ?? '—'
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
  const events = seasonEvents
    .filter((event) => event.status === 'completed')
    .map((event) => ({
      id: event.subsessionId ?? event.round,
      label: `${event.track} — ${event.date}`,
      sessions: [
        {
          id: (event.subsessionId ?? event.round) * 10 - 1,
          label: 'Overall',
          rows: rows
            .filter((row) => row.event.id === event.id)
            .sort((a, b) => a.overallPosition - b.overallPosition)
            .map((row) => ({
              position: row.overallPosition,
              podiumPosition: row.classPosition,
              driver: row.driver,
              class: gtClasses.find((item) => item.key === row.classKey)?.label ?? row.classKey,
              car: row.car,
              start: row.start,
              interval: row.overallPosition === 1 ? '-' : row.interval,
              laps: row.laps,
              led: row.lapsLed,
              racePoints: row.racePoints,
              bonus: row.bonus,
              penalty: row.penalty,
              total: row.total,
              incidents: row.incidents,
              status: row.status,
              pole: row.pole ? 1 : 0,
              fastestLap: row.fastestLap ? 1 : 0,
            })),
        },
        ...gtClasses.map(({ key, label }, index) => {
          const classRows = rows.filter((row) => row.event.id === event.id && row.classKey === key)
          const leader = classRows.find((row) => row.classPosition === 1)
          const fastest = Math.min(
            ...classRows.filter((row) => row.bestLapTime > 0).map((row) => row.bestLapTime),
          )
          return {
            id: (event.subsessionId ?? event.round) * 10 + index,
            label,
            rows: classRows.map((row) => ({
              position: row.classPosition,
              driver: row.driver,
              car: row.car,
              start: row.start,
              interval: classInterval(row, leader),
              laps: row.laps,
              led: row.lapsLed,
              racePoints: row.racePoints,
              bonus: row.bonus,
              penalty: row.penalty,
              total: row.total,
              incidents: row.incidents,
              status: row.status,
              pole: row.pole ? 1 : 0,
              fastestLap: row.bestLapTime > 0 && row.bestLapTime === fastest ? 1 : 0,
            })),
          }
        }),
      ],
    }))
  return { season, schedule, standings, teamStandings, events, source: 'in-house' }
}
