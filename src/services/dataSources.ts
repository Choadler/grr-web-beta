import { publicEndpoints } from '../config/integrations'
import { cupSchedule as cupCalendar } from '../config/schedules'
import type { DataLoader, DataResult, RaceEventsLoader } from '../types/league'
import {
  adaptRecentResults,
  adaptSimRacerEvents,
  adaptSimRacerLatestResults,
  adaptSimRacerSchedule,
  adaptSimRacerStandings,
} from './adapters'
import { fetchJson } from './http'
import { loadLocalGtPublic } from './gtAdmin'
import { loadLocalIndyPublic } from './indycarAdmin'

type IndyPublicPayload = {
  schedule?: unknown[]
  standings?: unknown[]
  events?: unknown[]
  season?: { name?: string }
}

async function indyInHouse(signal: AbortSignal): Promise<IndyPublicPayload> {
  const local = loadLocalIndyPublic()
  if (local) return local

  const season = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('season')
  const seasonQuery = season ? `?season=${encodeURIComponent(season)}` : ''

  const response = await fetch(`/api/indycar${seasonQuery}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`IndyCar data request failed (${response.status}).`)
  }
  return (await response.json()) as IndyPublicPayload
}

type GtPublicPayload = {
  schedule?: unknown[]
  standings?: Record<string, unknown[]>
  teamStandings?: Record<string, unknown[]>
  events?: unknown[]
  season?: { name?: string }
}

const gtClassKey = { am: 'gt3-am', pro: 'gt3-pro', gtp: 'gtp', 'gt3-am': 'gt3-am', 'gt3-pro': 'gt3-pro' } as const

function addBehindLeader(result: DataResult): DataResult {
  const leaderPoints = result.rows.reduce(
    (highest, row) => Math.max(highest, Number(row.points) || 0),
    0,
  )

  return {
    ...result,
    rows: result.rows.map((row) => {
      const gap = Math.max(0, leaderPoints - (Number(row.points) || 0))
      return { ...row, behindLeader: gap === 0 ? '—' : `-${gap.toLocaleString()}` }
    }),
  }
}

async function gtInHouse(signal: AbortSignal): Promise<GtPublicPayload> {
  const local = loadLocalGtPublic()
  if (local) return local
  const season = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('season')
  const seasonQuery = season ? `&season=${encodeURIComponent(season)}` : ''
  return (await fetchJson(`/api/gt?v=overall-results${seasonQuery}`, signal)) as GtPublicPayload
}

export type GtHistoryPayload = {
  stats: Record<string, string | number>[]
  records: Record<string, string | number>[]
}

export type GtCareerBreakdown = {
  key: string
  starts: number
  wins: number
  podiums: number
  poles: number
  fastestLaps: number
  points: number
  laps: number
  incidents: number
  averageFinish: number
  bestFinish: number
  classKey?: string
  classLabel?: string
  seasonId?: string
  season?: string
  championshipPosition?: number
  track?: string
}

export type GtCareerProfile = {
  driverKey: string
  driver: string
  starts: number
  wins: number
  podiums: number
  poles: number
  fastestLaps: number
  points: number
  laps: number
  incidents: number
  averageFinish: number
  bestFinish: number
  championships: number
  seasonsEntered: number
  classes: GtCareerBreakdown[]
  seasons: GtCareerBreakdown[]
  tracks: GtCareerBreakdown[]
  cars: string[]
  teams: string[]
}

const requireGtArray = (value: unknown, description: string): unknown[] => {
  if (Array.isArray(value)) return value
  throw new Error(`The in-house GT ${description} response is unavailable.`)
}

export async function gtHistory(signal: AbortSignal): Promise<GtHistoryPayload> {
  return (await fetchJson('/api/gt?view=history', signal)) as GtHistoryPayload
}

export async function gtCareer(driverKey: string, signal: AbortSignal): Promise<GtCareerProfile> {
  return (await fetchJson(`/api/gt?view=career&driver=${encodeURIComponent(driverKey)}`, signal)) as GtCareerProfile
}

export const gtHistoricalStats: DataLoader = async (signal) => {
  const payload = await gtHistory(signal)
  return { rows: payload.stats as never[] }
}

export const gtHistoricalRecords: DataLoader = async (signal) => {
  const payload = await gtHistory(signal)
  return {
    rows: payload.records.map((row) => ({
      class: row.classLabel,
      record: row.record,
      driver: row.drivers,
      total: row.value,
    })) as never[],
  }
}

export const cupStandings: DataLoader = async (signal) =>
  adaptSimRacerStandings(await fetchJson(publicEndpoints.cup.standings, signal))
export const cupRecentResults: DataLoader = async (signal) =>
  adaptRecentResults(await fetchJson(publicEndpoints.cup.recentResults, signal))
export const indyStandings: DataLoader = async (signal) => {
  const local = await indyInHouse(signal)
  return {
    rows: Array.isArray(local.standings) ? (local.standings as never[]) : [],
    label: local.season?.name,
  }
}
export const cupSchedule: DataLoader = async (signal) =>
  adaptSimRacerSchedule(await fetchJson(publicEndpoints.cup.standings, signal), cupCalendar, true)
export const cupDetailedResults: DataLoader = async (signal) =>
  adaptSimRacerLatestResults(await fetchJson(publicEndpoints.cup.standings, signal))
export const indySchedule: DataLoader = async (signal) => {
  const local = await indyInHouse(signal)
  const completedEventIds = new Set(
    (Array.isArray(local.events) ? local.events : []).map((value) =>
      String((value as Record<string, unknown>).sourceEventId ?? ''),
    ),
  )
  return {
    rows: Array.isArray(local.schedule)
      ? local.schedule.map((value) => {
          const row = value as Record<string, unknown>
          return {
            ...row,
            resultsUrl: row.eventId && completedEventIds.has(String(row.eventId))
              ? `/pages/indycar-results?event=${encodeURIComponent(String(row.eventId))}`
              : '',
          }
        }) as never[]
      : [],
    label: local.season?.name,
  }
}
export const cupRaceEvents: RaceEventsLoader = async (signal) =>
  adaptSimRacerEvents(await fetchJson(publicEndpoints.cup.standings, signal), cupCalendar, true)
export const indyRaceEvents: RaceEventsLoader = async (signal) => {
  const local = await indyInHouse(signal)
  return {
    events: Array.isArray(local.events) ? (local.events as never[]) : [],
    season: local.season?.name,
  }
}
export const gtRaceEvents: RaceEventsLoader = async (signal) => {
  const local = await gtInHouse(signal)
  const events = requireGtArray(local.events, 'race results')
  return {
    events: events as never[],
    season: local.season?.name,
    defaultEventIndex: Math.max(0, events.length - 1),
  }
}

export const gtStandings =
  (classKey: keyof typeof gtClassKey): DataLoader =>
  async (signal) => {
    const local = await gtInHouse(signal)
    const rows = local?.standings?.[gtClassKey[classKey]]
    return addBehindLeader({
      rows: requireGtArray(rows, 'standings') as never[],
      label: local?.season?.name,
    })
  }
export const gtTeamStandings =
  (classKey: keyof typeof gtClassKey): DataLoader =>
  async (signal) => {
    const local = await gtInHouse(signal)
    const rows = local?.teamStandings?.[gtClassKey[classKey]]
    return addBehindLeader({
      rows: requireGtArray(rows, 'team standings') as never[],
      label: local?.season?.name,
    })
  }
export const gtSchedule: DataLoader = async (signal) => {
  const local = await gtInHouse(signal)
  const season = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('season')
  return {
    rows: requireGtArray(local.schedule, 'schedule').map((value) => {
      const row = value as Record<string, unknown>
      const params = new URLSearchParams()
      if (season) params.set('season', season)
      if (row.eventId) params.set('event', String(row.eventId))
      return { ...row, resultsUrl: row.eventId && row.state === 'done' ? `/pages/gt-race-results?${params}` : '' }
    }) as never[],
    label: local.season?.name,
  }
}
export const gtResults =
  (classKey: 'am' | 'pro' | 'gtp'): DataLoader =>
  async (signal) => {
    const local = await gtInHouse(signal)
    const events = Array.isArray(local?.events) ? local.events : []
    const latest = events.at(-1) as
      { sessions?: { label?: string; rows?: unknown[] }[] } | undefined
    const label = { am: 'GT3 AM', pro: 'GT3 Pro', gtp: 'GTP' }[classKey]
    const session = latest?.sessions?.find((item) => item.label === label)
    return {
      rows: requireGtArray(session?.rows, `${label} race results`) as never[],
      label: local?.season?.name,
    }
  }
