export type CellValue = string | number
export type TableRow = Record<string, CellValue>

export type SeasonChampion = {
  driver: string
  label: string
  classKey?: string
}

export type SeasonChampionship = {
  seasonId: string
  seasonName: string
  isComplete: boolean
  champions: SeasonChampion[]
}

export type DataResult = {
  rows: TableRow[]
  updated?: string
  label?: string
  championship?: SeasonChampionship
}

export type DataLoader = (signal: AbortSignal) => Promise<DataResult>

export type RaceSession = { id: number; label: string; rows: TableRow[] }
export type RaceEvent = {
  id: number
  sourceEventId?: string
  label: string
  track?: string
  date?: string
  sessions: RaceSession[]
}
export type RaceEventsResult = { events: RaceEvent[]; season?: string; defaultEventIndex?: number }
export type RaceEventsLoader = (signal: AbortSignal) => Promise<RaceEventsResult>
