import { cupSchedule } from '../config/schedules'
import { publicEndpoints } from '../config/integrations'
import type {
  ComparisonDataset,
  ComparisonRace,
  ComparisonResult,
  ComparisonSeason,
  ComparisonSeries,
} from '../types/driverComparison'
import { fetchJson } from './http'
import { canonicalDriverName, driverKey } from './driverComparisonStats'

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

function cupDataset(payload: unknown): ComparisonDataset {
  const root = record(payload)
  const season = record(root.lss)
  const seasonId = text(season.season_id)
  const seasonName = text(season.season_name) || 'GRR Cup Series'
  const seasonKey = `cup:${seasonId}`
  const drivers = list(root.rps).map(record)
  const mainIds = new Set<number>()
  drivers.forEach((driver) =>
    list(driver.races).forEach((item) => {
      const race = record(item)
      if (
        text(race.session).toUpperCase() === 'RACE' &&
        text(race.count_stats).toUpperCase() === 'Y'
      )
        mainIds.add(number(race.race_id))
    }),
  )
  const ids = [...mainIds].filter(Boolean).sort((a, b) => a - b)
  const races = ids.map((raceId, index): ComparisonRace => {
    const scheduled = cupSchedule[index + (cupSchedule[0]?.round === 0 ? 1 : 0)]
    const previousId = ids[index - 1] ?? 0
    const stageIds = new Set<number>()
    drivers.forEach((driver) =>
      list(driver.races).forEach((item) => {
        const race = record(item)
        const id = number(race.race_id)
        if (id > previousId && id < raceId && text(race.session).toUpperCase() === 'SEGMENT')
          stageIds.add(id)
      }),
    )
    const fastest = drivers
      .map((driver) => record(record(driver.races)[String(raceId)]))
      .map((race) => number(race.fastest_lap_time))
      .filter((value) => value > 0)
      .sort((a, b) => a - b)[0]
    const results = drivers.flatMap((driver): ComparisonResult[] => {
      const race = record(record(driver.races)[String(raceId)])
      if (!Object.keys(race).length) return []
      const name = displayName(driver.name)
      const sourceDriverId = text(driver.drid ?? race.driver_id)
      const stageWins = [...stageIds].filter(
        (id) => number(record(record(driver.races)[String(id)]).finish_pos) === 1,
      ).length
      return [
        {
          driverKey: driverKey(name),
          driverName: name,
          sourceDriverId,
          finish: number(race.finish_pos),
          start: number(race.qualify_pos),
          points: number(race.total_points),
          stagePoints: number(race.stage_points),
          stageWins,
          lapsLed: number(race.laps_led),
          pole: number(race.qualify_pos) === 1,
          fastestLap: fastest > 0 && number(race.fastest_lap_time) === fastest,
          status: text(race.status),
        },
      ]
    })
    return {
      key: `cup:${raceId}`,
      sourceEventId: String(raceId),
      series: 'cup',
      seasonKey,
      seasonName,
      date: scheduled?.date ?? '',
      track: scheduled?.track ?? `Race ${index + 1}`,
      round: scheduled?.round ?? index + 1,
      resultsUrl: resultUrl('cup'),
      results,
    }
  })
  return {
    seasons: [
      {
        key: seasonKey,
        id: seasonId,
        series: 'cup',
        name: seasonName,
        year: Number(races[0]?.date.slice(0, 4)) || undefined,
      },
    ],
    races,
  }
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
        const name = displayName(row.driver)
        const classFinish = series === 'gt' ? number(row.classPosition) : undefined
        const overallFinish = series === 'gt' ? number(row.overallPosition) : undefined
        return {
          driverKey: driverKey(name),
          driverName: name,
          sourceDriverId: text(row.customerId) || `name:${canonicalDriverName(name)}`,
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
      resultsUrl: resultUrl(series),
      results,
    }
  })
  return { seasons, races }
}

export async function loadDriverComparisonData(signal: AbortSignal): Promise<ComparisonDataset> {
  const historyUrl = import.meta.env.DEV
    ? 'https://www.grassrootsracing.org/api/driver-comparison'
    : '/api/driver-comparison'
  const [cup, history] = await Promise.all([
    fetchJson(publicEndpoints.cup.standings, signal),
    fetchJson(historyUrl, signal),
  ])
  const cupData = cupDataset(cup)
  const gtData = d1Series(history, 'gt')
  const indyData = d1Series(history, 'indycar')
  return {
    seasons: [...cupData.seasons, ...gtData.seasons, ...indyData.seasons],
    races: [...cupData.races, ...gtData.races, ...indyData.races],
  }
}
