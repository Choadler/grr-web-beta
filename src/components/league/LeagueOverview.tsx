import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DataLoader, RaceEvent, RaceEventsLoader, TableRow } from '../../types/league'

type StandingsSource = { label?: string; loader: DataLoader }

type Props = {
  standings: StandingsSource[]
  results: RaceEventsLoader
  standingsHref: string
  resultsHref: string
  multiClass?: boolean
}

type StandingsGroup = { label?: string; rows: TableRow[] }

export function LeagueOverview({
  standings,
  results,
  standingsHref,
  resultsHref,
  multiClass = false,
}: Props) {
  const [standingsGroups, setStandingsGroups] = useState<StandingsGroup[]>([])
  const [latestRace, setLatestRace] = useState<RaceEvent | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      Promise.all(
        standings.map(async (source) => ({
          label: source.label,
          rows: (await source.loader(controller.signal)).rows,
        })),
      ),
      results(controller.signal),
    ])
      .then(([groups, raceResult]) => {
        setStandingsGroups(groups)
        setLatestRace(raceResult.events.at(-1) ?? null)
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })
    return () => controller.abort()
  }, [results, standings])

  if (status === 'loading')
    return <div className="league-overview-state">Loading league report...</div>
  if (status === 'error')
    return <div className="league-overview-state">League report is temporarily unavailable.</div>

  const rowLimit = multiClass ? 3 : 5
  const sessions = multiClass
    ? (latestRace?.sessions.filter((session) => session.label !== 'Overall') ?? [])
    : (latestRace?.sessions.slice(0, 1) ?? [])

  return (
    <section className="league-brief-grid" aria-label="Current league report">
      <article className="league-brief">
        <div className="league-brief__heading">
          <div>
            <p className="eyebrow">Current report</p>
            <h2>Standings Snapshot</h2>
          </div>
          <Link to={standingsHref}>Full standings</Link>
        </div>
        <div className={multiClass ? 'league-brief__groups' : undefined}>
          {standingsGroups.map((group, groupIndex) => (
            <div className="league-brief__group" key={group.label ?? groupIndex}>
              {group.label && <h3>{group.label}</h3>}
              <ol className="league-brief__list">
                {group.rows.slice(0, rowLimit).map((row, index) => (
                  <li key={`${String(row.driver)}-${index}`}>
                    <span className="league-brief__position">{String(row.rank ?? index + 1)}</span>
                    <strong>{String(row.driver)}</strong>
                    <span>{String(row.points ?? '')} pts</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </article>

      <article className="league-brief">
        <div className="league-brief__heading">
          <div>
            <p className="eyebrow">Most recent event</p>
            <h2>Last Race Results</h2>
          </div>
          <Link to={resultsHref}>Full results</Link>
        </div>
        {latestRace && <p className="league-brief__event">{latestRace.label}</p>}
        <div className={multiClass ? 'league-brief__groups' : undefined}>
          {sessions.map((session) => (
            <div className="league-brief__group" key={session.id}>
              {(multiClass || session.label !== 'Overall Race Finish') && <h3>{session.label}</h3>}
              <ol className="league-brief__list">
                {session.rows.slice(0, rowLimit).map((row, index) => (
                  <li key={`${String(row.driver)}-${index}`}>
                    <span className="league-brief__position">
                      {String(row.position ?? index + 1)}
                    </span>
                    <strong>{String(row.driver)}</strong>
                    <span>
                      {row.total !== undefined
                        ? `${String(row.total)} pts`
                        : row.points !== undefined
                          ? `${String(row.points)} pts`
                          : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
