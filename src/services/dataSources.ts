import { publicEndpoints } from '../config/integrations'
import { cupSchedule as cupCalendar } from '../config/schedules'
import type { DataLoader, DataResult, RaceEventsLoader, SeasonChampionship, TableRow } from '../types/league'
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
import { addCupChaseStatus } from './cupChase'

type IndyPublicPayload = {
  schedule?: unknown[]
  standings?: unknown[]
  events?: unknown[]
  season?: { id?: string; name?: string; isComplete?: boolean | number }
}

async function indyInHouse(signal: AbortSignal): Promise<IndyPublicPayload> {
  const local = loadLocalIndyPublic()
  if (local) return local

  const season = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('season')
  const seasonQuery = season ? `?season=${encodeURIComponent(season)}` : ''

  return (await fetchJson(`/api/indycar${seasonQuery}`, signal, undefined, false, false)) as IndyPublicPayload
}

type GtPublicPayload = {
  schedule?: unknown[]
  standings?: Record<string, unknown[]>
  teamStandings?: Record<string, unknown[]>
  events?: unknown[]
  classes?: { key?: string; label?: string }[]
  season?: { id?: string; name?: string; isComplete?: boolean | number }
}

type CupPublicPayload = {
  schedule?: unknown[]
  standings?: unknown[]
  events?: unknown[]
  season?: {
    name?: string
    id?: string
    isComplete?: boolean | number
    chaseEnabled?: boolean | number
    regularSeasonRaces?: number
    chaseSize?: number
    maxPointsPerRace?: number
  }
}

const championship = (
  season: { id?: string; name?: string; isComplete?: boolean | number } | undefined,
  champions: SeasonChampionship['champions'],
): SeasonChampionship | undefined => {
  const isComplete = season?.isComplete === true || Number(season?.isComplete) === 1
  if (!isComplete || !season?.id || !season.name || !champions.length) return undefined
  return { seasonId: season.id, seasonName: season.name, isComplete: true, champions }
}

const championRow = (rows: TableRow[], completed: boolean) =>
  rows.map((row) => completed && Number(row.rank) === 1 ? { ...row, champion: 1 } : row)

async function cupInHouse(signal: AbortSignal): Promise<CupPublicPayload | null> {
  const season = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('season')
  try {
    return (await fetchJson(`/api/cup${season ? `?season=${encodeURIComponent(season)}` : ''}`, signal, undefined, false, false)) as CupPublicPayload
  } catch (error) {
    if (error instanceof Error && /HTTP (404|503)/.test(error.message)) return null
    throw error
  }
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

export const cupStandings: DataLoader = async (signal) => {
  const local = await cupInHouse(signal)
  if (!local) return adaptSimRacerStandings(await fetchJson(publicEndpoints.cup.standings, signal))
  const historical = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('season')
  const rows = (local.standings ?? []) as never[]
  const season = local.season
  const chaseEnabled = season?.chaseEnabled === undefined ? true : Boolean(season.chaseEnabled)
  const completed = season?.isComplete === true || Number(season?.isComplete) === 1
  const presentedRows = historical ? rows : addCupChaseStatus(rows, {
    enabled: chaseEnabled,
    regularSeasonRaces: season?.regularSeasonRaces,
    chaseSize: season?.chaseSize,
    maxPointsPerRace: season?.maxPointsPerRace,
  })
  const winner = presentedRows.find((row) => Number(row.rank) === 1)
  return {
    rows: championRow(presentedRows, completed),
    label: season?.name,
    championship: championship(season, winner?.driver ? [{ driver: String(winner.driver), label: 'GRR Cup Series Champion' }] : []),
  }
}
export const cupRecentResults: DataLoader = async (signal) =>
  adaptRecentResults(await fetchJson(publicEndpoints.cup.recentResults, signal))
export const indyStandings: DataLoader = async (signal) => {
  const local = await indyInHouse(signal)
  const rows = Array.isArray(local.standings) ? (local.standings as TableRow[]) : []
  const completed = local.season?.isComplete === true || Number(local.season?.isComplete) === 1
  const winner = rows.find((row) => Number(row.rank) === 1)
  return {
    rows: championRow(rows, completed),
    label: local.season?.name,
    championship: championship(local.season, winner?.driver ? [{ driver: String(winner.driver), label: 'GRR IndyCar Champion' }] : []),
  }
}
export const cupSchedule: DataLoader = async (signal) => {
  const local = await cupInHouse(signal)
  if (!local) return adaptSimRacerSchedule(await fetchJson(publicEndpoints.cup.standings, signal), cupCalendar, true)
  const season = new URLSearchParams(window.location.search).get('season')
  return { rows: (local.schedule ?? []).map((value) => { const row = value as Record<string, unknown>; return { ...row, resultsUrl: row.state === 'done' ? `/pages/cup-latest-race-results?${season ? `season=${encodeURIComponent(season)}&` : ''}event=${encodeURIComponent(String(row.id))}` : '' } }) as never[], label: local.season?.name }
}
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
export const cupRaceEvents: RaceEventsLoader = async (signal) => {
  const local = await cupInHouse(signal)
  return local ? { events: (local.events ?? []) as never[], season: local.season?.name, defaultEventIndex: Math.max(0, (local.events?.length ?? 1) - 1) } : adaptSimRacerEvents(await fetchJson(publicEndpoints.cup.standings, signal), cupCalendar, true)
}

export type CupHistoryPayload = { stats: Record<string, string | number | null>[] }
export type CupPlayoffDriver = { driverId: number; driver: string; wins: number; totalPoints: number; roundOf12Wins: number; roundOf12Points: number; roundOf8Wins: number; roundOf8Points: number; finalCutoff: string; playoffPoints: number; outcome: 'champion' | 'championship-four' | 'round-of-8' | 'round-of-12' }
export type CupPlayoffPayload = { season: { id: string; name: string }; playoffs: null | { formatName: string; champion: string; championshipRound: number; sourceNote: string; rounds: Array<{ roundKey: string; label: string; startRound: number; endRound: number; tracks: string[]; advancingCount: number }>; drivers: CupPlayoffDriver[] } }
export type CupCareerProfile = Record<string, unknown> & { driverKey: string; driver: string; seasonsEntered: number; championships: number; seasons: Array<Record<string, string | number | null>>; races: Array<Record<string, string | number | null>> }
export const cupHistory = (signal: AbortSignal) => fetchJson('/api/cup?view=history', signal) as Promise<CupHistoryPayload>
export const cupCareer = (driverKey: string, signal: AbortSignal) => fetchJson(`/api/cup?view=career&driver=${encodeURIComponent(driverKey)}`, signal) as Promise<CupCareerProfile>
export const cupPlayoffs = (seasonId: string, signal: AbortSignal) => fetchJson(`/api/cup?view=playoffs&season=${encodeURIComponent(seasonId)}`, signal) as Promise<CupPlayoffPayload>
export const cupHistoricalStats: DataLoader = async (signal) => ({ rows: (await cupHistory(signal)).stats as never[] })
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
    const completed = local.season?.isComplete === true || Number(local.season?.isComplete) === 1
    const allChampions = (local.classes ?? []).flatMap((item) => {
      const winner = local.standings?.[String(item.key)]?.find((row) => Number((row as TableRow).rank) === 1) as TableRow | undefined
      return winner?.driver ? [{ driver: String(winner.driver), label: `${item.label ?? item.key} Champion`, classKey: String(item.key) }] : []
    })
    const result = addBehindLeader({
      rows: championRow(requireGtArray(rows, 'standings') as TableRow[], completed),
      label: local?.season?.name,
    })
    return { ...result, championship: championship(local.season, allChampions) }
  }
export const gtTeamStandings =
  (classKey: keyof typeof gtClassKey): DataLoader =>
  async (signal) => {
    const local = await gtInHouse(signal)
    const rows = local?.teamStandings?.[gtClassKey[classKey]]
    const allChampions = (local.classes ?? []).flatMap((item) => {
      const winner = local.standings?.[String(item.key)]?.find((row) => Number((row as TableRow).rank) === 1) as TableRow | undefined
      return winner?.driver ? [{ driver: String(winner.driver), label: `${item.label ?? item.key} Champion`, classKey: String(item.key) }] : []
    })
    const result = addBehindLeader({
      rows: requireGtArray(rows, 'team standings') as never[],
      label: local?.season?.name,
    })
    return { ...result, championship: championship(local.season, allChampions) }
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
