export type GtClassKey = 'gt3-am' | 'gt3-pro' | 'gtp'
export type GtSeasonStatus = 'draft' | 'active' | 'archived'

export type GtSeason = {
  id: string
  name: string
  status: GtSeasonStatus
  raceTime: string
  timezone: string
}
export type GtPointsRule = { position: number; points: number }
export type GtPointsConfig = {
  positions: GtPointsRule[]
  poleBonus: number
  fastestLapBonus: number
  lapLedBonus: number
  mostLapsLedBonus: number
}
export type GtScheduledEvent = {
  id: string
  seasonId: string
  round: number
  date: string
  track: string
  laps: number
  status: 'scheduled' | 'completed'
  subsessionId?: number
}
export type GtDriverAssignment = {
  id?: number
  seasonId: string
  customerId: number
  driver: string
  classKey: GtClassKey
  team: string
  car: string
}
export type GtTeam = {
  id: string
  seasonId: string
  name: string
  classKey: GtClassKey
  car: string
  memberIds: number[]
  memberNames: string[]
}
export type GtImportedDriver = {
  customerId?: number
  driver: string
  overallPosition: number
  start: number
  interval: string
  laps: number
  lapsLed: number
  incidents: number
  status: string
  bestLapTime: number
  car: string
}
export type GtImportPreview = {
  subsessionId?: number
  track: string
  raceDate: string
  drivers: GtImportedDriver[]
  warnings: string[]
}
export type GtManagedResult = GtImportedDriver & {
  id?: number
  classKey: GtClassKey
  classPosition: number
  team: string
  pole: boolean
  fastestLap: boolean
  racePoints: number
  bonus: number
  penalty: number
  total: number
}
export type GtImportRecord = {
  id: string
  seasonId: string
  eventId: string
  subsessionId?: number
  filename: string
  importedAt: string
}
export type GtAdminState = {
  seasons: GtSeason[]
  points: Record<string, Record<GtClassKey, GtPointsConfig>>
  schedule: GtScheduledEvent[]
  assignments: GtDriverAssignment[]
  teams: GtTeam[]
  results: Record<string, GtManagedResult[]>
  imports: GtImportRecord[]
}
export type GtPublicData = {
  season: GtSeason
  schedule: Record<string, string | number>[]
  standings: Record<GtClassKey, Record<string, string | number>[]>
  teamStandings: Record<GtClassKey, Record<string, string | number>[]>
  events: {
    id: number
    label: string
    sessions: { id: number; label: string; rows: Record<string, string | number>[] }[]
  }[]
  source: 'in-house'
}
