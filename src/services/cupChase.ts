import type { TableRow } from '../types/league'

const CHASE_SIZE = 16
const REGULAR_SEASON_RACES = 26
const MAX_POINTS_PER_RACE = 66

const points = (row: TableRow) => Number(row.points) || 0

export function addCupChaseStatus(rows: TableRow[]): TableRow[] {
  const ordered = [...rows].sort(
    (left, right) => Number(left.rank) - Number(right.rank) || points(right) - points(left),
  )
  if (ordered.length <= CHASE_SIZE) return ordered

  const lastIn = ordered[CHASE_SIZE - 1]
  const firstOut = ordered[CHASE_SIZE]
  const racesCompleted = ordered.reduce(
    (highest, row) => Math.max(highest, Number(row.starts) || 0),
    0,
  )
  const racesRemaining = Math.max(0, REGULAR_SEASON_RACES - racesCompleted)
  const clinchThreshold = points(firstOut) + racesRemaining * MAX_POINTS_PER_RACE

  return ordered.map((row, index) => {
    const inChase = index < CHASE_SIZE
    const difference = points(row) - points(inChase ? firstOut : lastIn)
    return {
      ...row,
      cutoff: `${difference >= 0 ? '+' : ''}${difference}`,
      chase: inChase && points(row) > clinchThreshold ? 'CLINCHED' : inChase ? 'IN' : '—',
    }
  })
}
