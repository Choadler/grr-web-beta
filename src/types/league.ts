export type CellValue = string | number
export type TableRow = Record<string, CellValue>

export type DataResult = {
  rows: TableRow[]
  updated?: string
  label?: string
}

export type DataLoader = (signal: AbortSignal) => Promise<DataResult>

export type RaceSession = { id: number; label: string; rows: TableRow[] }
export type RaceEvent = { id: number; label: string; sessions: RaceSession[] }
export type RaceEventsResult = { events: RaceEvent[]; season?: string; defaultEventIndex?: number }
export type RaceEventsLoader = (signal: AbortSignal) => Promise<RaceEventsResult>
