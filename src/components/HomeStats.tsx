import { useEffect, useState } from 'react'
import { fetchJson } from '../services/http'

type HomeStatsData = {
  uniqueDrivers: number
  races: number
  totalLaps: number
}

const numberFormatter = new Intl.NumberFormat('en-US')

function isHomeStatsData(value: unknown): value is HomeStatsData {
  if (!value || typeof value !== 'object') return false
  const stats = value as Record<string, unknown>
  return ['uniqueDrivers', 'races', 'totalLaps'].every(
    (key) => typeof stats[key] === 'number' && Number.isFinite(stats[key]) && stats[key] >= 0,
  )
}

export function HomeStats() {
  const [stats, setStats] = useState<HomeStatsData>()

  useEffect(() => {
    const controller = new AbortController()
    const url = import.meta.env.DEV
      ? 'https://www.grassrootsracing.org/api/grr-stats'
      : '/api/grr-stats'

    fetchJson(url, controller.signal)
      .then((payload) => {
        if (isHomeStatsData(payload)) setStats(payload)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [])

  return (
    <aside className="hero-stats" aria-labelledby="hero-stats-title" aria-live="polite">
      <p id="hero-stats-title">GRR By the Numbers</p>
      <dl>
        <div>
          <dd>{stats ? numberFormatter.format(stats.uniqueDrivers) : '—'}</dd>
          <dt>Unique Drivers</dt>
        </div>
        <div>
          <dd>{stats ? numberFormatter.format(stats.races) : '—'}</dd>
          <dt>Races</dt>
        </div>
        <div>
          <dd>{stats ? numberFormatter.format(stats.totalLaps) : '—'}</dd>
          <dt>Total Laps</dt>
        </div>
      </dl>
    </aside>
  )
}
