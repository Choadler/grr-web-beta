import type {
  Breakdown,
  ComparisonDataset,
  ComparisonFilters,
  ComparisonRace,
  ComparisonResult,
  DriverComparison,
  DriverOption,
  DriverStats,
  SharedRace,
} from '../types/driverComparison'

const rounded = (value: number) => Math.round(value * 10) / 10
const average = (values: number[]) =>
  values.length ? rounded(values.reduce((a, b) => a + b, 0) / values.length) : null
const validPosition = (value: number | undefined) => Number.isFinite(value) && Number(value) > 0

export function canonicalDriverName(value: string) {
  const clean = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  const comma = clean.match(/^([^,]+),\s*(.+)$/)
  return (comma ? `${comma[2]} ${comma[1]}` : clean).toLocaleLowerCase('en-US')
}

export function driverKey(name: string) {
  return `name:${canonicalDriverName(name)}`
}

export function reconcileVerifiedDriverAliases(dataset: ComparisonDataset): ComparisonDataset {
  const identityNames = new Map<string, Map<string, number>>()
  dataset.races.forEach((race) =>
    race.results.forEach((result) => {
      if (!result.sourceDriverId || result.sourceDriverId.startsWith('name:')) return
      const identity = `${race.series}:${result.sourceDriverId}`
      const names = identityNames.get(identity) ?? new Map<string, number>()
      names.set(result.driverName, (names.get(result.driverName) ?? 0) + 1)
      identityNames.set(identity, names)
    }),
  )

  const aliases = new Map<string, string>()
  identityNames.forEach((names) => {
    const entries = [...names.entries()]
    if (entries.length < 2) return
    const preferred = entries.sort((a, b) =>
      Number(/\d+$/.test(a[0])) - Number(/\d+$/.test(b[0])) || b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0]
    entries.forEach(([name]) => aliases.set(canonicalDriverName(name), preferred))
  })

  if (!aliases.size) return dataset
  return {
    ...dataset,
    races: dataset.races.map((race) => ({
      ...race,
      results: race.results.map((result) => {
        const preferred = aliases.get(canonicalDriverName(result.driverName))
        return preferred
          ? { ...result, driverName: preferred, driverKey: driverKey(preferred) }
          : result
      }),
    })),
  }
}

export function comparisonDriverOptions(dataset: ComparisonDataset): DriverOption[] {
  const drivers = new Map<string, DriverOption & { names: Map<string, number> }>()
  dataset.races.forEach((race) =>
    race.results.forEach((result) => {
      const item = drivers.get(result.driverKey) ?? {
        key: result.driverKey,
        name: result.driverName,
        starts: 0,
        names: new Map<string, number>(),
      }
      item.starts += 1
      item.names.set(result.driverName, (item.names.get(result.driverName) ?? 0) + 1)
      drivers.set(result.driverKey, item)
    }),
  )
  return [...drivers.values()]
    .map(({ names, ...driver }) => ({
      ...driver,
      name: [...names.entries()].sort((a, b) =>
        b[1] - a[1] || Number(/\d+$/.test(a[0])) - Number(/\d+$/.test(b[0])) || a[0].localeCompare(b[0]),
      )[0]?.[0] ?? driver.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function filteredRaces(dataset: ComparisonDataset, filters: ComparisonFilters) {
  return dataset.races.filter((race) => {
    if (filters.series !== 'all' && race.series !== filters.series) return false
    if (!filters.season || filters.season === 'all') return true
    if (filters.series === 'all' && filters.season.startsWith('year:'))
      return race.date.startsWith(filters.season.slice(5))
    return race.seasonKey === filters.season
  })
}

function stats(results: ComparisonResult[], finishOverride?: number[]): DriverStats {
  const finishes = finishOverride ?? results.map((result) => result.finish).filter(validPosition)
  const starts = results.map((result) => result.start).filter(validPosition) as number[]
  return {
    starts: results.length,
    wins: finishes.filter((value) => value === 1).length,
    podiums: finishes.filter((value) => value <= 3).length,
    top5: finishes.filter((value) => value <= 5).length,
    top10: finishes.filter((value) => value <= 10).length,
    poles: results.filter((result) => result.pole || result.start === 1).length,
    fastestLaps: results.filter((result) => result.fastestLap).length,
    stageWins: results.reduce((total, result) => total + (result.stageWins ?? 0), 0),
    averageFinish: average(finishes),
    bestFinish: finishes.length ? Math.min(...finishes) : null,
    worstFinish: finishes.length ? Math.max(...finishes) : null,
    averageStart: average(starts),
    lapsLed: results.reduce((total, result) => total + (result.lapsLed ?? 0), 0),
  }
}

export function calculateDriverHistory(
  dataset: ComparisonDataset,
  driver: DriverOption,
  filters: ComparisonFilters,
) {
  const races = filteredRaces(dataset, filters)
    .flatMap((race) => {
      const result = race.results.find((item) => item.driverKey === driver.key)
      return result ? [{ race, result }] : []
    })
    .sort((a, b) => b.race.date.localeCompare(a.race.date) || (b.race.round ?? 0) - (a.race.round ?? 0))
  return { driver, stats: stats(races.map((item) => item.result)), races }
}

function sharedRace(
  race: ComparisonRace,
  a: ComparisonResult,
  b: ComparisonResult,
): SharedRace | null {
  const differentGtClasses =
    race.series === 'gt' && Boolean(a.className && b.className && a.className !== b.className)
  const finishA = differentGtClasses ? a.overallFinish : (a.classFinish ?? a.finish)
  const finishB = differentGtClasses ? b.overallFinish : (b.classFinish ?? b.finish)
  if (!validPosition(finishA) || !validPosition(finishB)) return null
  const comparedA = Number(finishA)
  const comparedB = Number(finishB)
  return {
    race,
    driverA: a,
    driverB: b,
    finishA: comparedA,
    finishB: comparedB,
    winner: comparedA === comparedB ? 'tie' : comparedA < comparedB ? 'a' : 'b',
    differentGtClasses,
    margin: Math.abs(comparedA - comparedB),
  }
}

function breakdown(
  shared: SharedRace[],
  key: (race: SharedRace) => string,
  label: (race: SharedRace) => string,
): Breakdown[] {
  const groups = new Map<string, Breakdown>()
  shared.forEach((item) => {
    const id = key(item)
    const row = groups.get(id) ?? {
      key: id,
      label: label(item),
      races: 0,
      driverAWins: 0,
      driverBWins: 0,
      ties: 0,
    }
    row.races += 1
    if (item.winner === 'a') row.driverAWins += 1
    else if (item.winner === 'b') row.driverBWins += 1
    else row.ties += 1
    groups.set(id, row)
  })
  return [...groups.values()]
}

export function calculateDriverComparison(
  dataset: ComparisonDataset,
  driverA: DriverOption,
  driverB: DriverOption,
  filters: ComparisonFilters,
): DriverComparison {
  const races = filteredRaces(dataset, filters)
  const resultsA = races.flatMap((race) =>
    race.results.filter((result) => result.driverKey === driverA.key),
  )
  const resultsB = races.flatMap((race) =>
    race.results.filter((result) => result.driverKey === driverB.key),
  )
  const sharedRaces = races
    .flatMap((race) => {
      const a = race.results.find((result) => result.driverKey === driverA.key)
      const b = race.results.find((result) => result.driverKey === driverB.key)
      if (!a || !b) return []
      const item = sharedRace(race, a, b)
      return item ? [item] : []
    })
    .sort((a, b) => b.race.date.localeCompare(a.race.date) || b.race.round! - a.race.round!)
  const sharedAResults = sharedRaces.map((item) => item.driverA)
  const sharedBResults = sharedRaces.map((item) => item.driverB)
  const winners = sharedRaces.map((item) => item.winner)
  const streakWinner = winners[0] ?? 'tie'
  const streak = winners.findIndex((winner) => winner !== streakWinner)
  const biggest = (winner: 'a' | 'b') =>
    sharedRaces.filter((item) => item.winner === winner).sort((a, b) => b.margin - a.margin)[0]
  return {
    driverA,
    driverB,
    careerA: stats(resultsA),
    careerB: stats(resultsB),
    sharedA: stats(
      sharedAResults,
      sharedRaces.map((item) => item.finishA),
    ),
    sharedB: stats(
      sharedBResults,
      sharedRaces.map((item) => item.finishB),
    ),
    sharedRaces,
    driverAWins: winners.filter((winner) => winner === 'a').length,
    driverBWins: winners.filter((winner) => winner === 'b').length,
    ties: winners.filter((winner) => winner === 'tie').length,
    bySeries: breakdown(
      sharedRaces,
      (item) => item.race.series,
      (item) => ({ cup: 'Cup', gt: 'GT', indycar: 'IndyCar' })[item.race.series],
    ),
    byTrack: breakdown(
      sharedRaces,
      (item) => canonicalDriverName(item.race.track),
      (item) => item.race.track,
    ),
    recentForm: winners
      .slice(0, 5)
      .map((winner) => (winner === 'a' ? 'W' : winner === 'b' ? 'L' : 'T')),
    currentStreak: { driver: streakWinner, races: streak < 0 ? winners.length : streak },
    biggestA: biggest('a'),
    biggestB: biggest('b'),
    closest: [...sharedRaces].sort((a, b) => a.margin - b.margin)[0],
    bestCombined: [...sharedRaces].sort((a, b) => a.finishA + a.finishB - b.finishA - b.finishB)[0],
    mostRecentWinner: winners[0],
  }
}
