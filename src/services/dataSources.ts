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

  const response = await fetch('/api/indycar', {
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

const gtClassKey = { am: 'gt3-am', pro: 'gt3-pro', gtp: 'gtp' } as const

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
  return (await fetchJson('/api/gt?v=overall-results', signal)) as GtPublicPayload
}

const requireGtArray = (value: unknown, description: string): unknown[] => {
  if (Array.isArray(value)) return value
  throw new Error(`The in-house GT ${description} response is unavailable.`)
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
  return {
    rows: Array.isArray(local.schedule) ? (local.schedule as never[]) : [],
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
  (classKey: 'am' | 'pro' | 'gtp'): DataLoader =>
  async (signal) => {
    const local = await gtInHouse(signal)
    const rows = local?.standings?.[gtClassKey[classKey]]
    return addBehindLeader({
      rows: requireGtArray(rows, 'standings') as never[],
      label: local?.season?.name,
    })
  }
export const gtTeamStandings =
  (classKey: 'am' | 'pro' | 'gtp'): DataLoader =>
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
  return {
    rows: requireGtArray(local.schedule, 'schedule') as never[],
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
