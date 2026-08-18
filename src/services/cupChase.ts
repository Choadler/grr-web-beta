import type { TableRow } from '../types/league'

const DEFAULT_CHASE_SIZE = 16
const DEFAULT_REGULAR_SEASON_RACES = 26
const DEFAULT_MAX_POINTS_PER_RACE = 66

export type CupChaseConfig = {
  enabled?: boolean
  regularSeasonRaces?: number
  chaseSize?: number
  maxPointsPerRace?: number
}

const points = (row: TableRow) => Number(row.points) || 0

const positiveInteger = (value: number | undefined, fallback: number) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback

export function addCupChaseStatus(rows: TableRow[], config: CupChaseConfig = {}): TableRow[] {
  const ordered = [...rows].sort(
    (left, right) => Number(left.rank) - Number(right.rank) || points(right) - points(left),
  )
  if (config.enabled === false) {
    return ordered.map((row) => ({ ...row, cutoff: '—', chase: 'NO CHASE', chaseEnabled: 0, inChase: 0 }))
  }

  const chaseSize = positiveInteger(config.chaseSize, DEFAULT_CHASE_SIZE)
  const regularSeasonRaces = positiveInteger(config.regularSeasonRaces, DEFAULT_REGULAR_SEASON_RACES)
  const maxPointsPerRace = positiveInteger(config.maxPointsPerRace, DEFAULT_MAX_POINTS_PER_RACE)
  if (ordered.length <= chaseSize) return ordered.map((row) => ({ ...row, chaseEnabled: 1, chaseCutline: 0, inChase: 1 }))

  const lastIn = ordered[chaseSize - 1]
  const firstOut = ordered[chaseSize]
  const racesCompleted = ordered.reduce(
    (highest, row) => Math.max(highest, Number(row.starts) || 0),
    0,
  )
  const racesRemaining = Math.max(0, regularSeasonRaces - racesCompleted)
  const clinchThreshold = points(firstOut) + racesRemaining * maxPointsPerRace

  return ordered.map((row, index) => {
    const inChase = index < chaseSize
    const difference = points(row) - points(inChase ? firstOut : lastIn)
    return {
      ...row,
      chaseEnabled: 1,
      chaseCutline: index === chaseSize ? 1 : 0,
      inChase: inChase ? 1 : 0,
      cutoff: `${difference >= 0 ? '+' : ''}${difference}`,
      chase: inChase && points(row) > clinchThreshold ? 'CLINCHED' : inChase ? 'IN' : '—',
    }
  })
}
