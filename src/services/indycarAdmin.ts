import type { IndyAdminState, IndyImportPreview, IndyImportSource, IndyManagedResult, IndyPointsConfig, IndyPublicData, IndySeason, IndyScheduledEvent } from '../types/indycarAdmin'
import { adminFetch } from './adminSession'

const endpoint = '/admin/api/indycar'
const storageKey = 'grr-indycar-admin-preview-v1'

export const defaultIndyPoints: IndyPointsConfig = {
  positions: Array.from({ length: 33 }, (_, index) => ({
    position: index + 1,
    points: Math.max(5, 50 - index * 2),
  })),
  poleBonus: 1,
  lapLedBonus: 1,
  mostLapsLedBonus: 2,
}

export const emptyAdminState: IndyAdminState = { seasons: [], points: {}, schedule: [], results: {}, imports: [] }

function localState(): IndyAdminState {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '') as Partial<IndyAdminState>
    const state = { ...emptyAdminState, ...saved, points: saved.points ?? {}, results: saved.results ?? {} }
    state.seasons = state.seasons.map((season) => ({ ...season, isComplete: season.isComplete === true }))
    for (const event of state.schedule) {
      if (state.results[event.id]?.length) continue
      try {
        const preview = JSON.parse(localStorage.getItem(`${storageKey}:results:${event.id}`) ?? 'null') as IndyImportPreview | null
        if (!preview?.drivers.length) continue
        const config = state.points[event.seasonId] ?? defaultIndyPoints
        const mostLed = Math.max(0, ...preview.drivers.map((driver) => driver.lapsLed))
        state.results[event.id] = preview.drivers.map((driver, index) => {
          const position = index + 1
          const racePoints = config.positions.find((rule) => rule.position === position)?.points ?? 0
          const bonus = (driver.start === 1 ? config.poleBonus : 0) + (driver.lapsLed > 0 ? config.lapLedBonus : 0) + (mostLed > 0 && driver.lapsLed === mostLed ? config.mostLapsLedBonus : 0)
          return { ...driver, id: index + 1, position, racePoints, bonus, penalty: 0, total: racePoints + bonus }
        })
      } catch { /* Ignore incomplete legacy preview data. */ }
    }
    return state
  } catch {
    return emptyAdminState
  }
}

function saveLocal(state: IndyAdminState) {
  localStorage.setItem(storageKey, JSON.stringify(state))
  return state
}

async function request<T>(method: string, body?: unknown): Promise<T> {
  if (import.meta.env.DEV) {
    const state = structuredClone(localState())
    const action = record(body).action
    if (method === 'GET') return state as T
    if (action === 'saveSeason') {
      const season = record(body).season as IndySeason
      const existing = state.seasons.findIndex((item) => item.id === season.id)
      if (existing >= 0 && state.seasons[existing].status === 'active' && season.status !== 'active') throw new Error('Set another IndyCar season active before archiving the current public season.')
      if (season.status === 'active') state.seasons.forEach((item) => (item.status = 'archived'))
      if (existing >= 0) state.seasons[existing] = season
      else state.seasons.push(season)
      const sourceId = String(record(body).copyFrom ?? '')
      const copy = record(record(body).copy)
      state.points[season.id] ??= sourceId && copy.settings && state.points[sourceId] ? structuredClone(state.points[sourceId]) : structuredClone(defaultIndyPoints)
      if (existing < 0 && sourceId && copy.schedule) state.schedule.push(...state.schedule.filter((item) => item.seasonId === sourceId).map((item) => ({ ...item, id: crypto.randomUUID(), seasonId: season.id, status: 'scheduled' as const, subsessionId: undefined })))
    }
    if (action === 'savePoints') state.points[String(record(body).seasonId)] = record(body).points as IndyPointsConfig
    if (action === 'saveEvent') {
      const event = record(body).event as IndyScheduledEvent
      const existing = state.schedule.findIndex((item) => item.id === event.id)
      if (existing >= 0) state.schedule[existing] = event
      else state.schedule.push(event)
    }
    if (action === 'deleteEvent') state.schedule = state.schedule.filter((item) => item.id !== record(body).eventId)
    if (action === 'deleteResults') {
      const eventId = String(record(body).eventId)
      const event = state.schedule.find((item) => item.id === eventId)
      if (event) {
        event.status = 'scheduled'
        event.subsessionId = undefined
      }
      delete state.results[eventId]
      state.imports = state.imports.filter((item) => item.eventId !== eventId)
      localStorage.removeItem(`${storageKey}:results:${eventId}`)
    }
    if (action === 'publishResults') {
      const preview = record(record(body).preview)
      const eventId = String(record(body).eventId)
      const event = state.schedule.find((item) => item.id === eventId)
      if (event) {
        event.status = 'completed'
        event.subsessionId = Number(preview.subsessionId) || undefined
      }
      const importId = crypto.randomUUID()
      state.imports = state.imports.filter((item) => item.eventId !== eventId)
      state.imports.push({
        id: importId,
        seasonId: String(record(body).seasonId),
        eventId,
        subsessionId: Number(preview.subsessionId) || undefined,
        importedAt: new Date().toISOString(),
        filename: String(record(body).filename),
      })
      localStorage.setItem(`${storageKey}:results:${eventId}`, JSON.stringify(preview))
      localStorage.setItem(`${storageKey}:import:${importId}`, JSON.stringify(record(body).rawJson ?? preview))
      const config = state.points[String(record(body).seasonId)] ?? defaultIndyPoints
      const drivers = (preview.drivers as IndyImportPreview['drivers']) ?? []
      const mostLed = Math.max(0, ...drivers.map((driver) => driver.lapsLed))
      state.results[eventId] = drivers.map((driver, index) => {
        const position = index + 1
        const racePoints = config.positions.find((rule) => rule.position === position)?.points ?? 0
        const bonus = (driver.start === 1 ? config.poleBonus : 0) + (driver.lapsLed > 0 ? config.lapLedBonus : 0) + (mostLed > 0 && driver.lapsLed === mostLed ? config.mostLapsLedBonus : 0)
        return { ...driver, id: index + 1, position, racePoints, bonus, penalty: 0, total: racePoints + bonus }
      })
    }
    if (action === 'saveResults') {
      const eventId = String(record(body).eventId)
      const event = state.schedule.find((item) => item.id === eventId)
      const config = event ? state.points[event.seasonId] ?? defaultIndyPoints : defaultIndyPoints
      const rows = (record(body).results as IndyManagedResult[]) ?? []
      const mostLed = Math.max(0, ...rows.map((driver) => driver.lapsLed))
      state.results[eventId] = rows.map((driver, index) => {
        const position = index + 1
        const racePoints = config.positions.find((rule) => rule.position === position)?.points ?? 0
        const bonus = (driver.start === 1 ? config.poleBonus : 0) + (driver.lapsLed > 0 ? config.lapLedBonus : 0) + (mostLed > 0 && driver.lapsLed === mostLed ? config.mostLapsLedBonus : 0)
        const penalty = Math.max(0, Number(driver.penalty) || 0)
        return { ...driver, position, racePoints, bonus, penalty, total: racePoints + bonus - penalty }
      })
    }
    return saveLocal(state) as T
  }

  const response = await adminFetch(endpoint, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(String(record(payload).error || `Admin request failed (${response.status}).`))
  }
  return (await response.json()) as T
}

const record = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export const loadIndyAdmin = () => request<IndyAdminState>('GET')
export const mutateIndyAdmin = (body: unknown) => request<IndyAdminState>('POST', body)
export const loadIndyImportSource = async (item: IndyAdminState['imports'][number], state: IndyAdminState) => {
  if (import.meta.env.DEV) {
    const event = state.schedule.find((entry) => entry.id === item.eventId)
    const season = state.seasons.find((entry) => entry.id === item.seasonId)
    return { ...item, seasonName: season?.name ?? '', round: event?.round ?? 0, track: event?.track ?? '', rawJson: JSON.parse(localStorage.getItem(`${storageKey}:import:${item.id}`) ?? localStorage.getItem(`${storageKey}:results:${item.eventId}`) ?? 'null') } as IndyImportSource
  }
  const response = await adminFetch(`${endpoint}?import=${encodeURIComponent(item.id)}`, { credentials: 'include', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Could not load the original import (${response.status}).`)
  return (await response.json()) as IndyImportSource
}

const formatRaceInterval = (value: string, laps: number, leaderLaps: number, position: number) => {
  if (position === 1) return '-'
  const lapDifference = Math.max(0, leaderLaps - laps)
  if (lapDifference > 0) return `${lapDifference} Lap${lapDifference === 1 ? '' : 's'}`
  const tenThousandths = Number(value)
  if (!Number.isFinite(tenThousandths) || tenThousandths <= 0) return '-'
  return `+${(tenThousandths / 10000).toFixed(3)}`
}

export function loadLocalIndyPublic(): IndyPublicData | null {
  if (!import.meta.env.DEV) return null
  const state = localState()
  const requestedSeason = new URLSearchParams(window.location.search).get('season')
  const season = requestedSeason
    ? state.seasons.find((item) => item.id === requestedSeason && item.status !== 'draft')
    : state.seasons.find((item) => item.status === 'active')
  if (!season) return null
  const config = state.points[season.id] ?? defaultIndyPoints
  const eventsForSeason = state.schedule.filter((item) => item.seasonId === season.id).sort((a, b) => a.round - b.round)
  const scored = eventsForSeason.flatMap((event) => {
    const managed = state.results[event.id]
    if (managed?.length) return managed.map((driver) => ({ ...driver, event, points: driver.total }))
    let preview: IndyImportPreview | null = null
    try { preview = JSON.parse(localStorage.getItem(`${storageKey}:results:${event.id}`) ?? 'null') as IndyImportPreview | null } catch { preview = null }
    if (!preview) return []
    const mostLed = Math.max(...preview.drivers.map((driver) => driver.lapsLed))
    return preview.drivers.map((driver) => {
      const base = config.positions.find((rule) => rule.position === driver.position)?.points ?? 0
      const bonus = (driver.start === 1 ? config.poleBonus : 0) + (driver.lapsLed > 0 ? config.lapLedBonus : 0) + (mostLed > 0 && driver.lapsLed === mostLed ? config.mostLapsLedBonus : 0)
      return { ...driver, event, racePoints: base, bonus, penalty: 0, total: base + bonus, points: base + bonus }
    })
  })
  const totals = new Map<string, { driver: string; points: number; starts: number; wins: number; poles: number; top5: number; top10: number; lapsLed: number }>()
  scored.forEach((row) => {
    const key = row.customerId ? `id:${row.customerId}` : row.driver.toLowerCase()
    const total = totals.get(key) ?? { driver: row.driver, points: 0, starts: 0, wins: 0, poles: 0, top5: 0, top10: 0, lapsLed: 0 }
    total.points += row.points; total.starts += 1; total.wins += row.position === 1 ? 1 : 0; total.poles += row.start === 1 ? 1 : 0
    total.top5 += row.position <= 5 ? 1 : 0; total.top10 += row.position <= 10 ? 1 : 0; total.lapsLed += row.lapsLed
    totals.set(key, total)
  })
  const standings = [...totals.values()].sort((a, b) => b.points - a.points || b.wins - a.wins).map((row, index) => ({ rank: index + 1, ...row }))
  const schedule = eventsForSeason.map((event) => {
    const results = scored.filter((row) => row.event.id === event.id)
    return { eventId: event.id, round: event.round, date: event.date, track: event.track, laps: event.laps, winner: results.find((row) => row.position === 1)?.driver ?? '—', pole: results.find((row) => row.start === 1)?.driver ?? '—' }
  })
  const events = eventsForSeason.filter((event) => event.status === 'completed').map((event) => {
    const eventRows = scored.filter((row) => row.event.id === event.id).sort((a, b) => a.position - b.position)
    const leaderLaps = eventRows.find((row) => row.position === 1)?.laps ?? Math.max(0, ...eventRows.map((row) => row.laps))
    return { id: event.subsessionId ?? event.round, sourceEventId: event.id, label: `${event.track} — ${event.date}`, sessions: [{ id: event.subsessionId ?? event.round, label: 'Overall Race Finish', rows: eventRows.map((row) => ({ position: row.position, driver: row.driver, start: row.start, interval: formatRaceInterval(row.interval, row.laps, leaderLaps, row.position), laps: row.laps, led: row.lapsLed, racePoints: row.racePoints, bonus: row.bonus, penalty: row.penalty, total: row.total, incidents: row.incidents, status: row.status, fastestLap: row.fastestLap ? 1 : 0 })) }] }
  })
  return { season, schedule, standings, events, source: 'in-house' }
}
