import { useEffect, useMemo, useState } from 'react'
import type { ScheduledRace } from '../../config/schedules'
import type { DataLoader, TableRow } from '../../types/league'

type CountdownRace = { date: string; track: string }

const easternParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function normalizeDate(value: string) {
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (iso) return iso
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : ''
}

function easternRaceTime(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  const estimate = Date.UTC(year, month - 1, day, 20)
  const parts = Object.fromEntries(easternParts.formatToParts(estimate).map((part) => [part.type, Number(part.value)]))
  const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - estimate
  return estimate - offset
}

function rowsToRaces(rows: TableRow[]): CountdownRace[] {
  return rows.map((row) => ({ date: normalizeDate(String(row.date ?? '')), track: String(row.track ?? '') })).filter((race) => race.date && race.track)
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`
}

export function LeagueCountdown({ schedule, loader }: { schedule?: ScheduledRace[]; loader?: DataLoader }) {
  const [loadedRaces, setLoadedRaces] = useState<CountdownRace[]>([])
  const [status, setStatus] = useState(loader ? 'loading' : 'ready')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!loader) return
    const controller = new AbortController()
    loader(controller.signal).then((result) => {
      setLoadedRaces(rowsToRaces(result.rows))
      setStatus('ready')
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('error')
    })
    return () => controller.abort()
  }, [loader])

  const races = useMemo(() => {
    const source = schedule?.map((race) => ({ date: race.date, track: race.track })) ?? loadedRaces
    return source.map((race) => ({ ...race, startsAt: easternRaceTime(race.date) })).filter((race) => Number.isFinite(race.startsAt)).sort((a, b) => a.startsAt - b.startsAt)
  }, [loadedRaces, schedule])

  if (status === 'loading') return <div className="league-countdown"><span>Next race</span><strong>Loading schedule…</strong></div>
  if (status === 'error') return <div className="league-countdown"><span>Next race</span><strong>Schedule unavailable</strong></div>

  const racing = races.find((race) => now >= race.startsAt && now < race.startsAt + 4 * 60 * 60 * 1000)
  if (racing) return <div className="league-countdown league-countdown--live"><span>{racing.track}</span><strong>Racing Now!</strong></div>

  const next = races.find((race) => race.startsAt > now)
  if (!next) return <div className="league-countdown"><span>Next race</span><strong>Season Complete</strong></div>

  return <div className="league-countdown" role="timer" aria-label={`${next.track} starts in ${formatRemaining(next.startsAt - now)}`}>
    <span>Next: {next.track}</span>
    <strong>{formatRemaining(next.startsAt - now)}</strong>
  </div>
}
