export type ComparisonSeries = 'cup' | 'gt' | 'indycar'

export type ComparisonSeason = {
  key: string
  id: string
  series: ComparisonSeries
  name: string
  year?: number
}

export type ComparisonResult = {
  driverKey: string
  driverName: string
  sourceDriverId: string
  finish: number
  overallFinish?: number
  classFinish?: number
  start?: number
  points?: number
  stagePoints?: number
  stageWins?: number
  lapsLed?: number
  pole?: boolean
  fastestLap?: boolean
  status?: string
  className?: string
}

export type ComparisonRace = {
  key: string
  sourceEventId: string
  series: ComparisonSeries
  seasonKey: string
  seasonName: string
  date: string
  track: string
  round?: number
  resultsUrl: string
  results: ComparisonResult[]
}

export type ComparisonDataset = {
  seasons: ComparisonSeason[]
  races: ComparisonRace[]
}

export type DriverOption = { key: string; name: string; starts: number }

export type ComparisonFilters = {
  series: 'all' | ComparisonSeries
  season: string
}

export type DriverStats = {
  starts: number
  wins: number
  podiums: number
  top5: number
  top10: number
  poles: number
  fastestLaps: number
  stageWins: number
  averageFinish: number | null
  bestFinish: number | null
  worstFinish: number | null
  averageStart: number | null
  lapsLed: number
}

export type SharedRace = {
  race: ComparisonRace
  driverA: ComparisonResult
  driverB: ComparisonResult
  finishA: number
  finishB: number
  winner: 'a' | 'b' | 'tie'
  differentGtClasses: boolean
  margin: number
}

export type Breakdown = {
  key: string
  label: string
  races: number
  driverAWins: number
  driverBWins: number
  ties: number
}

export type DriverComparison = {
  driverA: DriverOption
  driverB: DriverOption
  careerA: DriverStats
  careerB: DriverStats
  sharedA: DriverStats
  sharedB: DriverStats
  sharedRaces: SharedRace[]
  driverAWins: number
  driverBWins: number
  ties: number
  bySeries: Breakdown[]
  byTrack: Breakdown[]
  recentForm: Array<'W' | 'L' | 'T'>
  currentStreak: { driver: 'a' | 'b' | 'tie'; races: number }
  biggestA?: SharedRace
  biggestB?: SharedRace
  closest?: SharedRace
  bestCombined?: SharedRace
  mostRecentWinner?: 'a' | 'b' | 'tie'
}
