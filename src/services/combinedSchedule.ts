export type ScheduleSeries = 'cup' | 'gt' | 'indycar'
export type ScheduleState = 'upcoming' | 'completed' | 'cancelled' | 'postponed' | 'other'

export type CombinedScheduleEvent = {
  id: string
  series: ScheduleSeries
  seriesLabel: string
  seasonId: string
  season: string
  seasonStatus: string
  round?: number
  name: string
  track?: string
  date?: string
  time?: string
  timezone?: string
  state: ScheduleState
  statusLabel: string
  winners: string[]
  resultsUrl?: string
}

type UnknownRecord = Record<string, unknown>
type SeasonSummary = { id: string; name: string; status?: string }

const seriesConfig: Record<ScheduleSeries, { label: string; endpoint: string; results: string }> = {
  cup: { label: 'Cup Series', endpoint: '/api/cup', results: '/pages/cup-latest-race-results' },
  gt: { label: 'GT League', endpoint: '/api/gt?v=overall-results', results: '/pages/gt-race-results' },
  indycar: { label: 'IndyCar', endpoint: '/api/indycar', results: '/pages/indycar-results' },
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const validWinner = (value: unknown) => {
  const winner = text(value)
  return winner && winner !== '—' && winner !== '-'
}

export function normalizeScheduleState(row: UnknownRecord, completedEventIds: Set<string>): ScheduleState {
  const status = text(row.status).toLowerCase()
  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'postponed') return 'postponed'
  if (status === 'completed' || row.state === 'done' || completedEventIds.has(String(row.eventId ?? row.id ?? ''))) return 'completed'
  if (!status || status === 'scheduled' || row.state === 'upcoming' || row.state === 'next') return 'upcoming'
  return 'other'
}

export function normalizeScheduleRows(series: ScheduleSeries, payload: UnknownRecord, fallbackSeason: SeasonSummary): CombinedScheduleEvent[] {
  const config = seriesConfig[series]
  const season = (payload.season && typeof payload.season === 'object' ? payload.season : fallbackSeason) as UnknownRecord
  const events = Array.isArray(payload.events) ? payload.events as UnknownRecord[] : []
  const completedEventIds = new Set(events.map((event) => String(event.sourceEventId ?? '')))
  const schedule = Array.isArray(payload.schedule) ? payload.schedule as UnknownRecord[] : []
  return schedule.map((row, index) => {
    const eventId = String(row.eventId ?? row.id ?? row.scheduleId ?? `${index + 1}`)
    const state = normalizeScheduleState(row, completedEventIds)
    const winners = series === 'gt'
      ? [row.gtp, row.pro, row.am].filter(validWinner).map(String)
      : [row.winner].filter(validWinner).map(String)
    const params = new URLSearchParams({ season: String(season.id ?? fallbackSeason.id), event: eventId })
    const track = text(row.track)
    const eventName = text(row.eventName)
    return {
      id: `${series}:${season.id ?? fallbackSeason.id}:${eventId}`,
      series,
      seriesLabel: config.label,
      seasonId: String(season.id ?? fallbackSeason.id),
      season: text(season.name) || fallbackSeason.name,
      seasonStatus: text(season.status) || fallbackSeason.status || '',
      round: Number.isFinite(Number(row.round)) ? Number(row.round) : undefined,
      name: eventName || track || `Round ${row.round ?? index + 1}`,
      track: track || undefined,
      date: text(row.date) || undefined,
      time: text(season.raceTime) || undefined,
      timezone: text(season.timezone) || undefined,
      state,
      statusLabel: state === 'completed' ? 'Completed' : state === 'upcoming' ? 'Upcoming' : state[0].toUpperCase() + state.slice(1),
      winners,
      resultsUrl: state === 'completed' && completedEventIds.has(eventId) ? `${config.results}?${params}` : undefined,
    }
  })
}

async function json(response: Response) {
  if (!response.ok) throw new Error(`Schedule request failed (${response.status}).`)
  return response.json() as Promise<UnknownRecord>
}

async function loadSeries(series: ScheduleSeries, signal: AbortSignal) {
  const config = seriesConfig[series]
  const listed = await json(await fetch(`${config.endpoint.split('?')[0]}?list=seasons`, { signal, headers: { Accept: 'application/json' } }))
  const seasons = Array.isArray(listed.seasons) ? listed.seasons as SeasonSummary[] : []
  const payloads = await Promise.all(seasons.map(async (season) => {
    const separator = config.endpoint.includes('?') ? '&' : '?'
    const payload = await json(await fetch(`${config.endpoint}${separator}season=${encodeURIComponent(season.id)}`, { signal, headers: { Accept: 'application/json' } }))
    return normalizeScheduleRows(series, payload, season)
  }))
  return payloads.flat()
}

export async function loadCombinedSchedule(signal: AbortSignal) {
  const settled = await Promise.allSettled((Object.keys(seriesConfig) as ScheduleSeries[]).map((series) => loadSeries(series, signal)))
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const events = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  if (!events.length && settled.every((result) => result.status === 'rejected')) throw new Error('The GRR schedule is temporarily unavailable.')
  return { events, unavailableSeries: settled.flatMap((result, index) => result.status === 'rejected' ? [(Object.keys(seriesConfig) as ScheduleSeries[])[index]] : []) }
}

const dateKey = (event: CombinedScheduleEvent) => {
  if (!event.date) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(`${event.date}T00:00:00Z`)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}
export function sortSchedule(events: CombinedScheduleEvent[], group: 'upcoming' | 'completed') {
  return [...events].sort((a, b) => group === 'upcoming' ? dateKey(a) - dateKey(b) : dateKey(b) - dateKey(a) || (b.round ?? 0) - (a.round ?? 0))
}

const compactDate = (date: string) => date.replaceAll('-', '')
const escapeIcs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
const calendarTitle = (event: CombinedScheduleEvent) => `GRR ${event.seriesLabel}: ${event.name}`
const eventUrl = (event: CombinedScheduleEvent, origin: string) => new URL(event.resultsUrl ?? '/schedule', origin).toString()

export function googleCalendarUrl(event: CombinedScheduleEvent, origin: string) {
  if (!event.date) return undefined
  const params = new URLSearchParams({ action: 'TEMPLATE', text: calendarTitle(event), details: `Grassroots Racing event. ${eventUrl(event, origin)}`, location: event.track ?? '' })
  if (event.time && event.timezone) {
    const start = `${compactDate(event.date)}T${event.time.replace(':', '')}00`
    params.set('dates', `${start}/${start}`)
    params.set('ctz', event.timezone)
  } else {
    const next = new Date(`${event.date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    params.set('dates', `${compactDate(event.date)}/${next.toISOString().slice(0, 10).replaceAll('-', '')}`)
  }
  return `https://calendar.google.com/calendar/render?${params}`
}

export function icsCalendar(event: CombinedScheduleEvent, origin: string) {
  if (!event.date) return undefined
  const url = eventUrl(event, origin)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Grassroots Racing//Schedule//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${escapeIcs(event.id)}@grassrootsracing.org`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`]
  if (event.time && event.timezone) lines.push(`DTSTART;TZID=${escapeIcs(event.timezone)}:${compactDate(event.date)}T${event.time.replace(':', '')}00`)
  else {
    const next = new Date(`${event.date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll('-', '')}`)
  }
  lines.push(`SUMMARY:${escapeIcs(calendarTitle(event))}`, `DESCRIPTION:${escapeIcs(`Grassroots Racing event. ${url}`)}`, `LOCATION:${escapeIcs(event.track ?? '')}`, `URL:${escapeIcs(url)}`, 'END:VEVENT', 'END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function calendarFilename(event: CombinedScheduleEvent) {
  return `${event.date ?? 'grr'}-${event.series}-${event.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.ics'
}
