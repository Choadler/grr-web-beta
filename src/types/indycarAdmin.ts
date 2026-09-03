import type { RaceEvent, TableRow } from './league'

export type IndySeasonStatus = 'draft' | 'active' | 'archived'

export type IndySeason = {
  id: string
  name: string
  status: IndySeasonStatus
  isComplete: boolean
  raceTime: string
  timezone: string
}

export type IndyPointsRule = {
  position: number
  points: number
}

export type IndyPointsConfig = {
  positions: IndyPointsRule[]
  poleBonus: number
  lapLedBonus: number
  mostLapsLedBonus: number
}

export type IndyScheduledEvent = {
  id: string
  seasonId: string
  round: number
  date: string
  track: string
  laps: number
  status: 'scheduled' | 'completed'
  subsessionId?: number
}

export type IndyImportedDriver = {
  customerId?: number
  driver: string
  position: number
  start: number
  interval: string
  laps: number
  lapsLed: number
  incidents: number
  status: string
  fastestLap: boolean
}

export type IndyImportPreview = {
  subsessionId?: number
  track: string
  raceDate?: string
  drivers: IndyImportedDriver[]
  warnings: string[]
}

export type IndyManagedResult = IndyImportedDriver & {
  id?: number
  racePoints: number
  bonus: number
  penalty: number
  total: number
}

export type IndyAdminState = {
  seasons: IndySeason[]
  points: Record<string, IndyPointsConfig>
  schedule: IndyScheduledEvent[]
  results: Record<string, IndyManagedResult[]>
  imports: Array<{
    id: string
    seasonId: string
    eventId: string
    subsessionId?: number
    importedAt: string
    filename: string
  }>
}

export type IndyImportSource = {
  id: string
  seasonId: string
  seasonName: string
  eventId: string
  round: number
  track: string
  filename: string
  importedAt: string
  rawJson: unknown
}

export type IndyPublicData = {
  season?: IndySeason
  schedule: TableRow[]
  standings: TableRow[]
  events: RaceEvent[]
  source: 'in-house'
}
