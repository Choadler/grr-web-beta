import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/league/States'
import { PageMeta } from '../components/league/PageMeta'
import {
  calculateDriverComparison,
  comparisonDriverOptions,
} from '../services/driverComparisonStats'
import { loadDriverComparisonData } from '../services/driverComparison'
import type {
  ComparisonDataset,
  ComparisonSeries,
  DriverOption,
  DriverStats,
} from '../types/driverComparison'
import { shareDriverComparisonImage } from '../utils/driverComparisonExport'

const seriesLabels = { all: 'All GRR', cup: 'Cup', gt: 'GT', indycar: 'IndyCar' } as const
const comparisonLeagueLabels = {
  all: 'All GRR comparison',
  cup: 'Cup Series comparison',
  gt: 'GT League comparison',
  indycar: 'IndyCar comparison',
} as const
const fmt = (value: number | null) => (value === null ? '—' : value.toFixed(1).replace(/\.0$/, ''))
const place = (value: number) => `P${value}`
const raceWinnerName = (race: ComparisonDataset['races'][number]) =>
  race.results.find((result) =>
    race.series === 'gt' ? result.overallFinish === 1 : result.finish === 1,
  )?.driverName

function DriverSearch({
  label,
  value,
  options,
  disabledKey,
  onChange,
}: {
  label: string
  value?: DriverOption
  options: DriverOption[]
  disabledKey?: string
  onChange: (driver?: DriverOption) => void
}) {
  const [query, setQuery] = useState(value?.name ?? '')
  const listId = `comparison-${label.toLowerCase().replace(' ', '-')}`
  return (
    <label className="comparison-driver-search">
      <span>{label}</span>
      <input
        type="search"
        list={listId}
        value={query}
        placeholder="Search driver name"
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          onChange(
            options.find(
              (driver) =>
                driver.name.toLocaleLowerCase() === next.toLocaleLowerCase() &&
                driver.key !== disabledKey,
            ),
          )
        }}
      />
      <datalist id={listId}>
        {options
          .filter((driver) => driver.key !== disabledKey)
          .map((driver) => (
            <option value={driver.name} key={driver.key}>
              {driver.starts} starts
            </option>
          ))}
      </datalist>
    </label>
  )
}

function StatRows({ left, right, cup }: { left: DriverStats; right: DriverStats; cup: boolean }) {
  const rows: Array<[string, string | number, string | number]> = [
    ['Race Starts', left.starts, right.starts],
    ['Wins', left.wins, right.wins],
    ['Podiums', left.podiums, right.podiums],
    ['Top 5s', left.top5, right.top5],
    ['Top 10s', left.top10, right.top10],
    ['Poles', left.poles, right.poles],
    ['Fastest Laps', left.fastestLaps, right.fastestLaps],
    ['Average Finish', fmt(left.averageFinish), fmt(right.averageFinish)],
    [
      'Best Finish',
      left.bestFinish ? place(left.bestFinish) : '—',
      right.bestFinish ? place(right.bestFinish) : '—',
    ],
    [
      'Worst Finish',
      left.worstFinish ? place(left.worstFinish) : '—',
      right.worstFinish ? place(right.worstFinish) : '—',
    ],
    ['Average Start', fmt(left.averageStart), fmt(right.averageStart)],
    ['Laps Led', left.lapsLed, right.lapsLed],
  ]
  if (cup) rows.splice(7, 0, ['Stage Wins', left.stageWins, right.stageWins])
  return (
    <div className="comparison-stat-rows">
      {rows.map(([label, a, b]) => (
        <div key={label}>
          <strong>{a}</strong>
          <span>{label}</span>
          <strong>{b}</strong>
        </div>
      ))}
    </div>
  )
}

export function DriverComparisonPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ComparisonDataset | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [trackSort, setTrackSort] = useState('races')
  const [shareStatus, setShareStatus] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    loadDriverComparisonData(controller.signal)
      .then(setData)
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'Comparison data could not be loaded.',
          )
      })
    return () => controller.abort()
  }, [retry])
  const options = useMemo(() => (data ? comparisonDriverOptions(data) : []), [data])
  const driverA = options.find((driver) => driver.key === params.get('driver1'))
  const requestedDriverB = options.find((driver) => driver.key === params.get('driver2'))
  const driverB = requestedDriverB?.key === driverA?.key ? undefined : requestedDriverB
  const series = (
    ['cup', 'gt', 'indycar'].includes(params.get('series') ?? '') ? params.get('series') : 'all'
  ) as 'all' | ComparisonSeries
  const season = params.get('season') ?? 'all'
  const update = (values: Record<string, string | undefined>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(values).forEach(([key, value]) =>
          value && value !== 'all' ? next.set(key, value) : next.delete(key),
        )
        return next
      },
      { replace: true },
    )
  const comparison =
    data && driverA && driverB
      ? calculateDriverComparison(data, driverA, driverB, { series, season })
      : null
  const seasons = (() => {
    if (!data) return []
    if (series === 'all')
      return [...new Set(data.races.map((race) => race.date.slice(0, 4)).filter(Boolean))]
        .sort()
        .reverse()
        .map((year) => ({ key: `year:${year}`, name: year }))
    return data.seasons
      .filter((item) => item.series === series)
      .map((item) => ({ key: item.key, name: item.name }))
  })()
  const tracks = comparison
    ? [...comparison.byTrack].sort((a, b) =>
        trackSort === 'name'
          ? a.label.localeCompare(b.label)
          : trackSort === 'a'
            ? b.driverAWins - b.driverBWins - (a.driverAWins - a.driverBWins)
            : trackSort === 'b'
              ? b.driverBWins - b.driverAWins - (a.driverBWins - a.driverAWins)
              : b.races - a.races,
      )
    : []
  if (error)
    return (
      <main className="comparison-page container">
        <ErrorState
          message={error}
          onRetry={() => {
            setError('')
            setRetry((value) => value + 1)
          }}
        />
      </main>
    )
  if (!data)
    return (
      <main className="comparison-page container">
        <LoadingState label="Loading GRR driver history…" />
      </main>
    )
  const summary = comparison
    ? comparison.sharedRaces.length
      ? `${comparison.driverAWins === comparison.driverBWins ? 'The matchup is tied' : `${comparison.driverAWins > comparison.driverBWins ? driverA!.name : driverB!.name} leads the matchup`} ${comparison.driverAWins}–${comparison.driverBWins} across ${comparison.sharedRaces.length} races together${comparison.ties ? ` with ${comparison.ties} tied result${comparison.ties === 1 ? '' : 's'}` : ''}.`
      : 'These drivers have not competed in the same GRR race under the selected filters.'
    : ''
  return (
    <main className="comparison-page">
      <PageMeta
        title="Driver Comparison"
        description="Compare Grassroots Racing drivers head to head across Cup, GT, and IndyCar."
      />
      <header className="comparison-hero">
        <div className="container">
          <p className="eyebrow">Grassroots Racing statistics</p>
          <h1>Driver Comparison</h1>
          <p>Compare any two GRR drivers across every race they competed in together.</p>
        </div>
      </header>
      <div className="container comparison-content">
        <section className="comparison-controls" aria-label="Driver comparison controls">
          <DriverSearch
            key={`a-${driverA?.key ?? 'empty'}`}
            label="Driver 1"
            value={driverA}
            options={options}
            disabledKey={driverB?.key}
            onChange={(driver) => update({ driver1: driver?.key })}
          />
          <span className="comparison-vs">VS.</span>
          <DriverSearch
            key={`b-${driverB?.key ?? 'empty'}`}
            label="Driver 2"
            value={driverB}
            options={options}
            disabledKey={driverA?.key}
            onChange={(driver) => update({ driver2: driver?.key })}
          />
        </section>
        <div className="comparison-filterbar">
          <div className="filter-group" role="group" aria-label="Series filter">
            {Object.entries(seriesLabels).map(([key, label]) => (
              <button
                className={series === key ? 'filter-button is-active' : 'filter-button'}
                aria-pressed={series === key}
                type="button"
                key={key}
                onClick={() => update({ series: key, season: undefined })}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Season
            <select value={season} onChange={(event) => update({ season: event.target.value })}>
              <option value="all">All Seasons</option>
              {seasons.map((item) => (
                <option value={item.key} key={item.key}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!driverA || !driverB ? (
          <section className="comparison-empty">
            <h2>{driverA || driverB ? 'Select an opponent' : 'Select two GRR drivers'}</h2>
            <p>
              {driverA || driverB
                ? 'Choose a second driver to begin the comparison.'
                : 'Search for two drivers to compare their GRR racing history.'}
            </p>
          </section>
        ) : (
          comparison && (
            <>
              <section className="comparison-score" id="comparison-share">
                <div>
                  <small>Driver 1</small>
                  <h2>{driverA.name}</h2>
                </div>
                <div className="comparison-score__numbers">
                  <strong>{comparison.driverAWins}</strong>
                  <span>—</span>
                  <strong>{comparison.driverBWins}</strong>
                  <small>{comparison.sharedRaces.length} races together</small>
                </div>
                <div>
                  <small>Driver 2</small>
                  <h2>{driverB.name}</h2>
                </div>
                <p>{summary}</p>
                <span className="comparison-score__league">{comparisonLeagueLabels[series]}</span>
              </section>
              <div className="comparison-actions">
                <button
                  className="button"
                  type="button"
                  onClick={async () => {
                    const status = await shareDriverComparisonImage(
                      comparison,
                      `${comparisonLeagueLabels[series]} • ${season === 'all' ? 'All Seasons' : (seasons.find((item) => item.key === season)?.name ?? season)}`,
                    )
                    setShareStatus(
                      status === 'copied' ? 'Image copied for Discord.' : 'Image downloaded.',
                    )
                  }}
                >
                  Share Comparison
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(window.location.href)
                      .then(() => setShareStatus('Comparison link copied.'))
                  }
                >
                  Copy Link
                </button>
                <span role="status">{shareStatus}</span>
              </div>
              <section className="comparison-panel">
                <p className="eyebrow">Career / filtered statistics</p>
                <div className="comparison-names">
                  <strong>{driverA.name}</strong>
                  <strong>{driverB.name}</strong>
                </div>
                <StatRows
                  left={comparison.careerA}
                  right={comparison.careerB}
                  cup={
                    series === 'cup' ||
                    comparison.careerA.stageWins > 0 ||
                    comparison.careerB.stageWins > 0
                  }
                />
              </section>
              <section className="comparison-panel">
                <p className="eyebrow">Head-to-head races only</p>
                <h2>Head-to-Head</h2>
                <div className="comparison-names">
                  <strong>{driverA.name}</strong>
                  <strong>{driverB.name}</strong>
                </div>
                <StatRows
                  left={comparison.sharedA}
                  right={comparison.sharedB}
                  cup={
                    series === 'cup' ||
                    comparison.sharedA.stageWins > 0 ||
                    comparison.sharedB.stageWins > 0
                  }
                />
              </section>
              {series === 'all' && comparison.bySeries.length > 0 && (
                <section className="comparison-panel">
                  <p className="eyebrow">By discipline</p>
                  <h2>By Series</h2>
                  <div className="comparison-breakdown">
                    {comparison.bySeries.map((item) => (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => update({ series: item.key, season: undefined })}
                      >
                        <strong>{item.label}</strong>
                        <span>
                          {driverA.name} {item.driverAWins} — {item.driverBWins} {driverB.name}
                        </span>
                        <small>{item.races} races</small>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="comparison-panel comparison-form">
                <p className="eyebrow">Last 5 races together</p>
                <div className="comparison-form__marks">
                  {comparison.recentForm.length ? (
                    comparison.recentForm.map((mark, index) => (
                      <span className={`is-${mark.toLowerCase()}`} key={index}>
                        {mark}
                      </span>
                    ))
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <strong>
                  {comparison.recentForm.filter((mark) => mark === 'W').length ===
                  comparison.recentForm.filter((mark) => mark === 'L').length
                    ? 'Last five are tied'
                    : `${comparison.recentForm.filter((mark) => mark === 'W').length > comparison.recentForm.filter((mark) => mark === 'L').length ? driverA.name : driverB.name} leads the last five`}{' '}
                  {comparison.recentForm.filter((mark) => mark === 'W').length}–
                  {comparison.recentForm.filter((mark) => mark === 'L').length}
                </strong>
              </section>
              {comparison.sharedRaces.length > 0 && (
                <section className="comparison-panel">
                  <p className="eyebrow">Rivalry records</p>
                  <h2>Biggest Performances</h2>
                  <div className="comparison-records">
                    {comparison.biggestA && (
                      <div>
                        <span>Biggest {driverA.name} advantage</span>
                        <strong>+{comparison.biggestA.margin} positions</strong>
                        <small>{comparison.biggestA.race.track}</small>
                      </div>
                    )}
                    {comparison.biggestB && (
                      <div>
                        <span>Biggest {driverB.name} advantage</span>
                        <strong>+{comparison.biggestB.margin} positions</strong>
                        <small>{comparison.biggestB.race.track}</small>
                      </div>
                    )}
                    {comparison.closest && (
                      <div>
                        <span>Closest race</span>
                        <strong>
                          {comparison.closest.margin} position
                          {comparison.closest.margin === 1 ? '' : 's'}
                        </strong>
                        <small>{comparison.closest.race.track}</small>
                      </div>
                    )}
                    {comparison.bestCombined && (
                      <div>
                        <span>Best combined finish</span>
                        <strong>
                          P{comparison.bestCombined.finishA} + P{comparison.bestCombined.finishB}
                        </strong>
                        <small>{comparison.bestCombined.race.track}</small>
                      </div>
                    )}
                    <div>
                      <span>Current streak</span>
                      <strong>
                        {comparison.currentStreak.driver === 'tie'
                          ? 'Tied result'
                          : comparison.currentStreak.driver === 'a'
                            ? driverA.name
                            : driverB.name}
                      </strong>
                      <small>
                        {comparison.currentStreak.races} race
                        {comparison.currentStreak.races === 1 ? '' : 's'}
                      </small>
                    </div>
                  </div>
                </section>
              )}
              <section className="comparison-panel">
                <div className="comparison-panel__heading">
                  <div>
                    <p className="eyebrow">Every shared start</p>
                    <h2>Races Together</h2>
                  </div>
                  <strong>{comparison.sharedRaces.length}</strong>
                </div>
                {!comparison.sharedRaces.length ? (
                  <p>No shared races found for this series or season.</p>
                ) : (
                  <>
                    <div className="comparison-race-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Series</th>
                            <th>Track</th>
                            <th>{driverA.name}</th>
                            <th>{driverB.name}</th>
                            <th>Winner</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.sharedRaces.map((item) => (
                            <tr key={item.race.key}>
                              <td>{item.race.date}</td>
                              <td>{seriesLabels[item.race.series]}</td>
                              <td><Link className="comparison-race-link" to={item.race.resultsUrl}>{item.race.track}</Link></td>
                              <td className={item.winner === 'a' ? 'is-winner' : item.winner === 'b' ? 'is-loser' : ''}>
                                {place(item.finishA)}
                              </td>
                              <td className={item.winner === 'b' ? 'is-winner' : item.winner === 'a' ? 'is-loser' : ''}>
                                {place(item.finishB)}
                              </td>
                              <td>
                                {item.winner === 'tie'
                                  ? 'Tie'
                                  : item.winner === 'a'
                                    ? driverA.name
                                    : driverB.name}
                              </td>
                              <td>
                                <details>
                                  <summary>Details</summary>
                                  <div className="comparison-race-detail">
                                    <span>
                                      Round {item.race.round ?? '—'} • {item.race.seasonName}
                                    </span>
                                    <span>
                                      Starts: P{item.driverA.start || '—'} / P
                                      {item.driverB.start || '—'}
                                    </span>
                                    <span>
                                      Points: {item.driverA.points ?? '—'} /{' '}
                                      {item.driverB.points ?? '—'}
                                    </span>
                                    {raceWinnerName(item.race) && (
                                      <span>Race winner: {raceWinnerName(item.race)}</span>
                                    )}
                                    <span>Position difference: {item.margin} positions</span>
                                    <span>
                                      Laps led: {item.driverA.lapsLed ?? 0} /{' '}
                                      {item.driverB.lapsLed ?? 0}
                                    </span>
                                    <span>
                                      Pole:{' '}
                                      {item.driverA.pole
                                        ? driverA.name
                                        : item.driverB.pole
                                          ? driverB.name
                                          : 'Neither'}
                                    </span>
                                    <span>
                                      Fastest lap:{' '}
                                      {item.driverA.fastestLap
                                        ? driverA.name
                                        : item.driverB.fastestLap
                                          ? driverB.name
                                          : 'Neither'}
                                    </span>
                                    {item.race.series === 'cup' && (
                                      <span>
                                        Stage points: {item.driverA.stagePoints ?? 0} /{' '}
                                        {item.driverB.stagePoints ?? 0}
                                      </span>
                                    )}
                                    {item.race.series === 'gt' && (
                                      <span>
                                        Class: {item.driverA.className} / {item.driverB.className}
                                        {item.differentGtClasses
                                          ? ' • Compared by overall finish'
                                          : ''}
                                        {' • '}Class P{item.driverA.classFinish ?? '—'} / P
                                        {item.driverB.classFinish ?? '—'} • Overall P
                                        {item.driverA.overallFinish ?? '—'} / P
                                        {item.driverB.overallFinish ?? '—'}
                                      </span>
                                    )}
                                    <Link to={item.race.resultsUrl}>View Full Race Results</Link>
                                  </div>
                                </details>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="comparison-race-cards">
                      {comparison.sharedRaces.map((item) => (
                        <details key={item.race.key}>
                          <summary>
                            <strong><Link className="comparison-race-link" to={item.race.resultsUrl}>{item.race.track}</Link></strong>
                            <span>
                              {seriesLabels[item.race.series]} • {item.race.date}
                            </span>
                            <span className={item.winner === 'a' ? 'is-winner' : item.winner === 'b' ? 'is-loser' : ''}>
                              {driverA.name} <b>{place(item.finishA)}</b>
                            </span>
                            <span className={item.winner === 'b' ? 'is-winner' : item.winner === 'a' ? 'is-loser' : ''}>
                              {driverB.name} <b>{place(item.finishB)}</b>
                            </span>
                            <small>
                              {item.winner === 'tie'
                                ? 'Tied finish'
                                : `${item.winner === 'a' ? driverA.name : driverB.name} +${item.margin} positions`}
                            </small>
                          </summary>
                          <div>
                            <p>
                              Round {item.race.round ?? '—'} • {item.race.seasonName}
                            </p>
                            <p>
                              Starts: P{item.driverA.start || '—'} / P{item.driverB.start || '—'}
                            </p>
                            <p>
                              Points: {item.driverA.points ?? '—'} / {item.driverB.points ?? '—'}
                            </p>
                            {raceWinnerName(item.race) && (
                              <p>Race winner: {raceWinnerName(item.race)}</p>
                            )}
                            <p>Position difference: {item.margin} positions</p>
                            <p>
                              Laps led: {item.driverA.lapsLed ?? 0} / {item.driverB.lapsLed ?? 0}
                            </p>
                            <p>
                              Pole:{' '}
                              {item.driverA.pole
                                ? driverA.name
                                : item.driverB.pole
                                  ? driverB.name
                                  : 'Neither'}
                            </p>
                            <p>
                              Fastest lap:{' '}
                              {item.driverA.fastestLap
                                ? driverA.name
                                : item.driverB.fastestLap
                                  ? driverB.name
                                  : 'Neither'}
                            </p>
                            {item.race.series === 'cup' && (
                              <p>
                                Stage points: {item.driverA.stagePoints ?? 0} /{' '}
                                {item.driverB.stagePoints ?? 0}
                              </p>
                            )}
                            {item.race.series === 'gt' && (
                              <p>
                                {item.driverA.className} / {item.driverB.className}
                                {item.differentGtClasses ? ' • Overall finish compared' : ''}
                                {' • '}Class P{item.driverA.classFinish ?? '—'} / P
                                {item.driverB.classFinish ?? '—'} • Overall P
                                {item.driverA.overallFinish ?? '—'} / P
                                {item.driverB.overallFinish ?? '—'}
                              </p>
                            )}
                            <Link className="button button--compact" to={item.race.resultsUrl}>
                              View Full Race Results
                            </Link>
                          </div>
                        </details>
                      ))}
                    </div>
                  </>
                )}
              </section>
              {tracks.length > 0 && (
                <section className="comparison-panel">
                  <div className="comparison-panel__heading">
                    <div>
                      <p className="eyebrow">Shared-race records</p>
                      <h2>By Track</h2>
                    </div>
                    <label>
                      Sort
                      <select
                        value={trackSort}
                        onChange={(event) => setTrackSort(event.target.value)}
                      >
                        <option value="races">Most races together</option>
                        <option value="a">Driver 1 advantage</option>
                        <option value="b">Driver 2 advantage</option>
                        <option value="name">Track name</option>
                      </select>
                    </label>
                  </div>
                  <div className="comparison-track-grid">
                    {tracks.map((item) => (
                      <div key={item.key}>
                        <strong>{item.label}</strong>
                        <span>
                          {item.driverAWins}–{item.driverBWins}
                          {item.ties ? `–${item.ties} ties` : ''}
                        </span>
                        <small>
                          {item.races} race{item.races === 1 ? '' : 's'}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )
        )}
      </div>
    </main>
  )
}
