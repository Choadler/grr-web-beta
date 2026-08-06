export type CellValue = string | number
export type TableRow = Record<string, CellValue>

export type DataResult = {
  rows: TableRow[]
  updated?: string
  label?: string
}

export type DataLoader = (signal: AbortSignal) => Promise<DataResult>
