import type {
  ComparisonDataset,
  ComparisonRace,
  ComparisonResult,
  ComparisonSeason,
  ComparisonSeries,
} from '../types/driverComparison'
import { fetchJson } from './http'
import { canonicalDriverName, driverKey, reconcileVerifiedDriverAliases } from './driverComparisonStats'

type UnknownRecord = Record<string, unknown>
const record = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
const list = (value: unknown) =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []
const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => Number(value) || 0
const displayName = (value: unknown) => {
  const name = text(value)
  const comma = name.match(/^([^,]+),\s*(.+)$/)
  return comma ? `${comma[2]} ${comma[1]}` : name
}
const bool = (value: unknown) => value === true || value === 1 || value === '1'
const classLabel = (value: unknown) =>
  ({ 'gt3-am': 'GT3 AM', 'gt3-pro': 'GT3 Pro', gtp: 'GTP' })[text(value)] ?? text(value)
const resultUrl = (series: ComparisonSeries) =>
  ({
    cup: '/pages/cup-latest-race-results',
    gt: '/pages/gt-race-results',
    indycar: '/pages/indycar-results',
  })[series]

function d1CupSeries(payload: unknown): ComparisonDataset {
  const source = record(record(payload).cup)
  const seasons: ComparisonSeason[] = list(source.seasons).map((item) => {
    const season = record(item)
    return { key: `cup:${text(season.id)}`, id: text(season.id), series: 'cup', name: text(season.name) }
  })
  const rows = list(source.results).map(record)
  const races: ComparisonRace[] = list(source.races).map((item) => {
    const race = record(item)
    const season = seasons.find((entry) => entry.id === text(race.seasonId))
    const raceRows = rows.filter((row) => text(row.eventId) === text(race.id))
    const fastest = raceRows.filter((row) => number(row.fastestLapTime) > 0).sort((a, b) => number(a.fastestLapTime) - number(b.fastestLapTime) || number(a.finish) - number(b.finish))[0]
    const results = raceRows.map((row): ComparisonResult => {
      const name = displayName(row.driver)
      return { driverKey: driverKey(name), driverName: name, sourceDriverId: text(row.driverId), finish: number(row.finish), start: number(row.start), points: number(row.points), stagePoints: number(row.stagePoints), stageWins: number(row.stageWins), lapsLed: number(row.lapsLed), pole: number(row.start) === 1, fastestLap: fastest === row, status: text(row.status) }
    })
    const date = text(race.date)
    if (season && !season.year) season.year = Number(date.slice(0, 4)) || undefined
    return { key: `cup:${text(race.id)}`, sourceEventId: text(race.id), series: 'cup', seasonKey: season?.key ?? `cup:${text(race.seasonId)}`, seasonName: season?.name ?? 'Cup', date, track: text(race.track), round: number(race.round), resultsUrl: `${resultUrl('cup')}?season=${encodeURIComponent(season?.id ?? text(race.seasonId))}&event=${encodeURIComponent(text(race.id))}`, results }
  })
  return { seasons, races }
}

function d1Series(payload: unknown, series: 'gt' | 'indycar'): ComparisonDataset {
  const source = record(record(payload)[series])
  const seasons: ComparisonSeason[] = list(source.seasons).map((item) => {
    const season = record(item)
    return {
      key: `${series}:${text(season.id)}`,
      id: text(season.id),
      series,
      name: text(season.name),
    }
  })
  const rows = list(source.results).map(record)
  const races: ComparisonRace[] = list(source.races).map((item) => {
    const race = record(item)
    const season = seasons.find((entry) => entry.id === text(race.seasonId))
    const results = rows
      .filter((row) => text(row.eventId) === text(race.id))
      .map((row): ComparisonResult => {
        const customerId = text(row.customerId)
        const name = displayName(row.driver)
        const sourceDriverId = customerId || `name:${canonicalDriverName(name)}`
        const classFinish = series === 'gt' ? number(row.classPosition) : undefined
        const overallFinish = series === 'gt' ? number(row.overallPosition) : undefined
        return {
          driverKey: driverKey(name),
          driverName: name,
          sourceDriverId,
          finish: classFinish ?? number(row.finish),
          classFinish,
          overallFinish,
          start: number(row.start),
          points: number(row.points),
          lapsLed: number(row.lapsLed),
          pole: bool(row.pole) || number(row.start) === 1,
          fastestLap: bool(row.fastestLap),
          status: text(row.status),
          className: series === 'gt' ? classLabel(row.classKey) : undefined,
        }
      })
    const date = text(race.date)
    if (season && !season.year) season.year = Number(date.slice(0, 4)) || undefined
    return {
      key: `${series}:${text(race.id)}`,
      sourceEventId: text(race.id),
      series,
      seasonKey: season?.key ?? `${series}:${text(race.seasonId)}`,
      seasonName: season?.name ?? series,
      date,
      track: text(race.track),
      round: number(race.round),
      resultsUrl: `${resultUrl(series)}?season=${encodeURIComponent(season?.id ?? text(race.seasonId))}&event=${encodeURIComponent(text(race.id))}`,
      results,
    }
  })
  return { seasons, races }
}

export async function loadDriverComparisonData(signal: AbortSignal): Promise<ComparisonDataset> {
  const historyUrl = import.meta.env.DEV
    ? 'https://www.grassrootsracing.org/api/driver-comparison'
    : '/api/driver-comparison'
  const history = await fetchJson(historyUrl, signal)
  const cupData = d1CupSeries(history)
  const gtData = d1Series(history, 'gt')
  const indyData = d1Series(history, 'indycar')
  return reconcileVerifiedDriverAliases({
    seasons: [...cupData.seasons, ...gtData.seasons, ...indyData.seasons],
    races: [...cupData.races, ...gtData.races, ...indyData.races],
  })
}
