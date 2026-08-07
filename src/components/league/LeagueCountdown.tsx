import { useEffect, useMemo, useState } from 'react'
import type { ScheduledRace } from '../../config/schedules'
import type { DataLoader, TableRow } from '../../types/league'
import { easternRaceTime, formatRemaining, normalizeScheduleDate } from '../../utils/raceTime'

type CountdownRace = { date: string; track: string }
type CountdownPart = { value: string; label: string }
type Props = {
  schedule?: ScheduledRace[]
  loader?: DataLoader
  leagueLabel?: string
  variant?: 'card' | 'banner'
}

function rowsToRaces(rows: TableRow[]): CountdownRace[] {
  return rows
    .map((row) => ({
      date: normalizeScheduleDate(String(row.date ?? '')),
      track: String(row.track ?? ''),
    }))
    .filter((race) => race.date && race.track)
}

function countdownParts(milliseconds: number): CountdownPart[] {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return [
    { value: String(Math.floor(seconds / 86400)), label: 'Days' },
    { value: String(Math.floor((seconds % 86400) / 3600)).padStart(2, '0'), label: 'Hours' },
    { value: String(Math.floor((seconds % 3600) / 60)).padStart(2, '0'), label: 'Minutes' },
    { value: String(seconds % 60).padStart(2, '0'), label: 'Seconds' },
  ]
}

export function LeagueCountdown({ schedule, loader, leagueLabel, variant = 'card' }: Props) {
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
    loader(controller.signal)
      .then((result) => {
        setLoadedRaces(rowsToRaces(result.rows))
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })
    return () => controller.abort()
  }, [loader])

  const races = useMemo(() => {
    const source = schedule?.map((race) => ({ date: race.date, track: race.track })) ?? loadedRaces
    return source
      .map((race) => ({ ...race, startsAt: easternRaceTime(race.date) }))
      .filter((race) => Number.isFinite(race.startsAt))
      .sort((a, b) => a.startsAt - b.startsAt)
  }, [loadedRaces, schedule])

  const className = `league-countdown${variant === 'banner' ? ' league-countdown--banner' : ''}`
  const heading = leagueLabel ? `Next ${leagueLabel} race` : 'Next race'
  if (status === 'loading')
    return (
      <div className={className}>
        <span>{heading}</span>
        <strong>Loading schedule...</strong>
      </div>
    )
  if (status === 'error')
    return (
      <div className={className}>
        <span>{heading}</span>
        <strong>Schedule unavailable</strong>
      </div>
    )

  const racing = races.find(
    (race) => now >= race.startsAt && now < race.startsAt + 4 * 60 * 60 * 1000,
  )
  if (racing)
    return (
      <div className={`${className} league-countdown--live`}>
        <span>{leagueLabel ?? racing.track}</span>
        <strong>Racing Now!</strong>
        {variant === 'banner' && <em>{racing.track}</em>}
      </div>
    )

  const next = races.find((race) => race.startsAt > now)
  if (!next)
    return (
      <div className={className}>
        <span>{heading}</span>
        <strong>Season Complete</strong>
      </div>
    )

  const remaining = next.startsAt - now

  if (variant === 'banner')
    return (
      <div
        className={className}
        role="timer"
        aria-label={`${heading} in ${formatRemaining(remaining)} at ${next.track}`}
      >
        <div className="league-countdown__race">
          <span>{heading}</span>
          <em>{next.track}</em>
        </div>
        <div className="league-countdown__clock" aria-hidden="true">
          {countdownParts(remaining).map((part) => (
            <span className="league-countdown__unit" key={part.label}>
              <strong>{part.value}</strong>
              <small>{part.label}</small>
            </span>
          ))}
        </div>
      </div>
    )

  return (
    <div
      className={className}
      role="timer"
      aria-label={`${heading} in ${formatRemaining(remaining)} at ${next.track}`}
    >
      <span>{`Next: ${next.track}`}</span>
      <strong>{formatRemaining(remaining)}</strong>
    </div>
  )
}
