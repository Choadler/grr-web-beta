import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { LeagueAdminNav, type LeagueAdminTool } from '../components/admin/LeagueAdminNav'
import { ImportSourceViewer, type ImportSource } from '../components/admin/ImportSourceViewer'
import { loadIndyAdmin, loadIndyImportSource, mutateIndyAdmin, defaultIndyPoints } from '../services/indycarAdmin'
import { parseIndycarResultJson } from '../services/indycarImport'
import type {
  IndyAdminState,
  IndyImportPreview,
  IndyManagedResult,
  IndyPointsConfig,
  IndyScheduledEvent,
  IndySeason,
} from '../types/indycarAdmin'

const id = () => crypto.randomUUID()
const newSeason = (): IndySeason => ({
  id: id(),
  name: 'IndyCar Season 1',
  status: 'draft',
  raceTime: '20:00',
  timezone: 'America/New_York',
})

function AdminNotice({ error, saved }: { error: string; saved: string }) {
  if (error) return <p className="admin-notice admin-notice--error">{error}</p>
  if (saved) return <p className="admin-notice admin-notice--success">{saved}</p>
  return null
}

function RaceEditor({
  event,
  rows,
  refresh,
  close,
}: {
  event: IndyScheduledEvent
  rows: IndyManagedResult[]
  refresh: (message?: string) => Promise<void>
  close: () => void
}) {
  const [results, setResults] = useState(rows)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const move = (from: number, to: number) => {
    if (to < 0 || to >= results.length || from === to) return
    const next = [...results]
    const [driver] = next.splice(from, 1)
    next.splice(to, 0, driver)
    setResults(next.map((row, index) => ({ ...row, position: index + 1 })))
  }
  const save = async () => {
    setBusy(true)
    await mutateIndyAdmin({ action: 'saveResults', eventId: event.id, results })
    await refresh('Race order, penalties, and points were updated.')
    setBusy(false)
    close()
  }
  return (
    <div className="admin-race-editor">
      <div className="admin-race-editor__heading">
        <div>
          <p className="eyebrow">Race review</p>
          <h3>
            Round {event.round}: {event.track}
          </h3>
        </div>
        <button className="button button--compact button--secondary" type="button" onClick={close}>
          Close race
        </button>
      </div>
      <p>
        Drag drivers into order, use the move buttons for keyboard control, and enter penalty-point
        deductions before rescoring.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table admin-results-editor">
          <thead>
            <tr>
              <th>Order</th>
              <th>Pos</th>
              <th>Driver</th>
              <th>Start</th>
              <th>Race Pts</th>
              <th>Bonus</th>
              <th>Penalty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {results.map((driver, index) => (
              <tr
                key={driver.id ?? `${driver.customerId}-${driver.driver}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index)
                  setDragIndex(null)
                }}
              >
                <td>
                  <span className="drag-handle" title="Drag to reorder" aria-hidden="true">
                    ↕
                  </span>
                  <button
                    type="button"
                    aria-label={`Move ${driver.driver} up`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${driver.driver} down`}
                    disabled={index === results.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    ↓
                  </button>
                </td>
                <td>{index + 1}</td>
                <td>{driver.driver}</td>
                <td>{driver.start || '-'}</td>
                <td>{driver.racePoints}</td>
                <td>{driver.bonus}</td>
                <td>
                  <input
                    aria-label={`Penalty points for ${driver.driver}`}
                    type="number"
                    min="0"
                    value={driver.penalty}
                    onChange={(event) =>
                      setResults(
                        results.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, penalty: Math.max(0, Number(event.target.value) || 0) }
                            : row,
                        ),
                      )
                    }
                  />
                </td>
                <td>{driver.racePoints + driver.bonus - driver.penalty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="button" type="button" disabled={busy} onClick={() => void save()}>
        {busy ? 'Rescoring…' : 'Save & rescore race'}
      </button>
    </div>
  )
}

type AdminSectionControl = {
  open?: boolean
  onToggle?: (open: boolean) => void
  standalone?: boolean
}

function AdminSection({
  eyebrow,
  title,
  summary,
  open,
  onToggle,
  standalone,
  children,
}: {
  eyebrow: string
  title: string
  summary?: string
  children: React.ReactNode
} & AdminSectionControl) {
  if (standalone) return <section className="admin-card admin-card--standalone">
    <header className="admin-card__standalone-heading"><small>{eyebrow}</small><h2>{title}</h2>{summary ? <p>{summary}</p> : null}</header>
    <div className="admin-card__content">{children}</div>
  </section>
  return (
    <details
      className="admin-card admin-card--collapsible"
      open={open}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary>
        <span>
          <small>{eyebrow}</small>
          <strong>{title}</strong>
          {!open && summary ? <span className="admin-card__summary">{summary}</span> : null}
        </span>
        <span className="admin-card__toggle" aria-hidden="true">
          Open
        </span>
      </summary>
      <div className="admin-card__content">{children}</div>
    </details>
  )
}

function SeasonEditor({
  state,
  seasonId,
  refresh,
  ...section
}: { state: IndyAdminState; seasonId?: string; refresh: (message?: string) => Promise<void> } & AdminSectionControl) {
  const [season, setSeason] = useState<IndySeason>(
    state.seasons.find((item) => item.id === seasonId) ?? state.seasons.find((item) => item.status === 'active') ?? state.seasons[0] ?? newSeason(),
  )
  const [copyFrom, setCopyFrom] = useState('')
  const [copy, setCopy] = useState({ settings: true, schedule: false })
  const isNew = !state.seasons.some((item) => item.id === season.id)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    await mutateIndyAdmin({ action: 'saveSeason', season, copyFrom: isNew ? copyFrom : '', copy })
    await refresh('Season saved.')
    setBusy(false)
  }
  return (
    <AdminSection eyebrow="Season control" title="IndyCar season" {...section}>
      {state.seasons.length > 0 && (
        <label>
          Season
          <select
            value={season.id}
            onChange={(event) =>
              setSeason(state.seasons.find((item) => item.id === event.target.value) ?? newSeason())
            }
          >
            {state.seasons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.status})
              </option>
            ))}
            <option value="">Create new season</option>
          </select>
        </label>
      )}
      <div className="admin-form-grid">
        <label>
          Season name
          <input
            value={season.name}
            onChange={(event) => setSeason({ ...season, name: event.target.value })}
          />
        </label>
        <label>
          Status
          <select
            value={season.status}
            onChange={(event) =>
              setSeason({ ...season, status: event.target.value as IndySeason['status'] })
            }
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          Race time
          <input
            type="time"
            value={season.raceTime}
            onChange={(event) => setSeason({ ...season, raceTime: event.target.value })}
          />
        </label>
        <label>
          Time zone
          <input
            value={season.timezone}
            onChange={(event) => setSeason({ ...season, timezone: event.target.value })}
          />
        </label>
      </div>
      {isNew && state.seasons.length ? <fieldset className="admin-copy-options"><legend>Initialize from another season</legend>
        <label>Copy from<select value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}><option value="">Start blank</option>{state.seasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {copyFrom ? <div><label><input type="checkbox" checked={copy.settings} onChange={(event) => setCopy({ ...copy, settings: event.target.checked })} /> Scoring settings</label><label><input type="checkbox" checked={copy.schedule} onChange={(event) => setCopy({ ...copy, schedule: event.target.checked })} /> Schedule structure</label></div> : null}
        <small>Results, standings, penalties, completed-race state, and imported JSON are never copied.</small>
      </fieldset> : null}
      <button
        className="button"
        type="button"
        disabled={busy || !season.name}
        onClick={() => void save()}
      >
        {busy ? 'Saving…' : 'Save season'}
      </button>
    </AdminSection>
  )
}

function PointsEditor({
  state,
  seasonId,
  refresh,
  ...section
}: {
  state: IndyAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & AdminSectionControl) {
  const [config, setConfig] = useState<IndyPointsConfig>(
    state.points[seasonId] ?? defaultIndyPoints,
  )
  const updatePosition = (index: number, points: number) =>
    setConfig({
      ...config,
      positions: config.positions.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, points } : rule,
      ),
    })
  const save = async () => {
    await mutateIndyAdmin({ action: 'savePoints', seasonId, points: config })
    await refresh('Points table saved.')
  }
  return (
    <AdminSection eyebrow="Scoring" title="Points table" {...section}>
      <div className="admin-card__actions">
        <button
          className="button button--compact"
          type="button"
          onClick={() => setConfig(defaultIndyPoints)}
        >
          Reset draft
        </button>
      </div>
      <div className="admin-form-grid admin-form-grid--bonuses">
        <label>
          Pole bonus
          <input
            type="number"
            min="0"
            value={config.poleBonus}
            onChange={(event) => setConfig({ ...config, poleBonus: Number(event.target.value) })}
          />
        </label>
        <label>
          Lead a lap bonus
          <input
            type="number"
            min="0"
            value={config.lapLedBonus}
            onChange={(event) => setConfig({ ...config, lapLedBonus: Number(event.target.value) })}
          />
        </label>
        <label>
          Most laps led bonus
          <input
            type="number"
            min="0"
            value={config.mostLapsLedBonus}
            onChange={(event) =>
              setConfig({ ...config, mostLapsLedBonus: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="points-grid">
        {config.positions.map((rule, index) => (
          <label key={rule.position}>
            <span>P{rule.position}</span>
            <input
              aria-label={`Points for position ${rule.position}`}
              type="number"
              min="0"
              value={rule.points}
              onChange={(event) => updatePosition(index, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
      <button className="button" type="button" onClick={() => void save()}>
        Save points table
      </button>
    </AdminSection>
  )
}

function ScheduleEditor({
  state,
  seasonId,
  refresh,
  ...section
}: {
  state: IndyAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & AdminSectionControl) {
  const seasonEvents = state.schedule
    .filter((event) => event.seasonId === seasonId)
    .sort((a, b) => a.round - b.round)
  const completedCount = seasonEvents.filter((event) => event.status === 'completed').length
  const scheduledCount = seasonEvents.filter((event) => event.status === 'scheduled').length
  const scheduleSummary = `${completedCount} completed · ${scheduledCount} scheduled · ${seasonEvents.length} total`
  const blank = (): IndyScheduledEvent => ({
    id: id(),
    seasonId,
    round: seasonEvents.length + 1,
    date: '',
    track: '',
    laps: 0,
    status: 'scheduled',
  })
  const [event, setEvent] = useState<IndyScheduledEvent>(blank())
  const [viewEventId, setViewEventId] = useState('')
  const save = async () => {
    await mutateIndyAdmin({ action: 'saveEvent', event })
    setEvent(blank())
    await refresh('Schedule updated.')
  }
  const remove = async (eventId: string) => {
    if (!confirm('Remove this scheduled event?')) return
    await mutateIndyAdmin({ action: 'deleteEvent', eventId })
    await refresh('Event removed.')
  }
  const deleteResults = async (eventId: string) => {
    if (!confirm('Delete the published results for this race? The scheduled event will remain.'))
      return
    await mutateIndyAdmin({ action: 'deleteResults', eventId })
    if (viewEventId === eventId) setViewEventId('')
    await refresh('Race results deleted. The event is scheduled again.')
  }
  return (
    <AdminSection eyebrow="Calendar" title="Schedule" summary={scheduleSummary} {...section}>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Date</th>
              <th>Track</th>
              <th>Laps</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {seasonEvents.length ? (
              seasonEvents.map((item) => {
                const hasResults = Boolean(state.results[item.id]?.length)
                return (
                  <tr key={item.id}>
                    <td>{item.round}</td>
                    <td>{item.date}</td>
                    <td>{item.track}</td>
                    <td>{item.laps}</td>
                    <td>{item.status}</td>
                    <td>
                      {hasResults && (
                        <>
                          <button type="button" onClick={() => setViewEventId(item.id)}>
                            Edit Race
                          </button>{' '}
                          <button
                            className="admin-action--danger"
                            type="button"
                            onClick={() => void deleteResults(item.id)}
                          >
                            Delete Results
                          </button>{' '}
                        </>
                      )}
                      <button type="button" onClick={() => void remove(item.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6}>No scheduled events yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {viewEventId && state.results[viewEventId]?.length ? (
        <RaceEditor
          key={viewEventId}
          event={seasonEvents.find((item) => item.id === viewEventId)!}
          rows={state.results[viewEventId]}
          refresh={refresh}
          close={() => setViewEventId('')}
        />
      ) : null}
      <h3>{seasonEvents.some((item) => item.id === event.id) ? 'Edit event' : 'Add event'}</h3>
      <div className="admin-form-grid">
        <label>
          Round
          <input
            type="number"
            min="1"
            value={event.round}
            onChange={(e) => setEvent({ ...event, round: Number(e.target.value) })}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={event.date}
            onChange={(e) => setEvent({ ...event, date: e.target.value })}
          />
        </label>
        <label>
          Track
          <input
            value={event.track}
            onChange={(e) => setEvent({ ...event, track: e.target.value })}
          />
        </label>
        <label>
          Laps
          <input
            type="number"
            min="1"
            value={event.laps || ''}
            onChange={(e) => setEvent({ ...event, laps: Number(e.target.value) })}
          />
        </label>
      </div>
      <button
        className="button"
        type="button"
        disabled={!event.date || !event.track || !event.laps}
        onClick={() => void save()}
      >
        Save event
      </button>
    </AdminSection>
  )
}

function ResultsImporter({
  state,
  seasonId,
  refresh,
  ...section
}: {
  state: IndyAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & AdminSectionControl) {
  const [preview, setPreview] = useState<IndyImportPreview | null>(null)
  const [rawJson, setRawJson] = useState<unknown>(null)
  const [filename, setFilename] = useState('')
  const [eventId, setEventId] = useState('')
  const [viewId, setViewId] = useState('')
  const [source, setSource] = useState<ImportSource | null>(null)
  const [error, setError] = useState('')
  const events = state.schedule.filter((item) => item.seasonId === seasonId)
  const publishedSeasons = state.seasons
    .filter((season) => season.id === seasonId)
    .map((season) => ({
      season,
      events: state.schedule
        .filter(
          (item) =>
            item.seasonId === season.id &&
            item.status === 'completed' &&
            Boolean(state.results[item.id]?.length),
        )
        .sort((a, b) => a.round - b.round),
    }))
    .filter((group) => group.events.length)
  const publishedCount = publishedSeasons.reduce((total, group) => total + group.events.length, 0)
  const lastImport = state.imports.filter((item) => item.seasonId === seasonId).at(-1)
  const lastImportedEvent = events.find((item) => item.id === lastImport?.eventId)
  const read = async (file?: File) => {
    if (!file) return
    try {
      const payload: unknown = JSON.parse(await file.text())
      setRawJson(payload)
      setPreview(parseIndycarResultJson(payload))
      setFilename(file.name)
      setError('')
    } catch (reason) {
      setRawJson(null)
      setPreview(null)
      setError(reason instanceof Error ? reason.message : 'Could not read that JSON file.')
    }
  }
  const publish = async () => {
    if (!preview || !eventId) return
    await mutateIndyAdmin({
      action: 'publishResults',
      seasonId,
      eventId,
      preview,
      rawJson,
      filename,
    })
    setPreview(null)
    setRawJson(null)
    setFilename('')
    setEventId('')
    await refresh('Race results published and standings recalculated.')
  }
  return (
    <AdminSection
      eyebrow="Race control"
      title="Import Race"
      summary={`${publishedCount} published`}
      {...section}
    >
      <p>
        The original JSON is retained for auditing. Nothing is published until you review the
        preview and assign it to a scheduled event.
      </p>
      <label className="json-drop">
        Race results JSON
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => void read(event.target.files?.[0])}
        />
      </label>
      {error && <p className="admin-notice admin-notice--error">{error}</p>}
      {preview && (
        <div className="import-preview">
          <div className="import-preview__summary">
            <div>
              <strong>{preview.track}</strong>
              <span>
                {preview.drivers.length} drivers · Subsession {preview.subsessionId ?? 'not found'}
              </span>
            </div>
            <label>
              Scheduled event
              <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="">Select event…</option>
                {events.map((item) => (
                  <option key={item.id} value={item.id}>
                    Round {item.round}: {item.track} — {item.date}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {preview.warnings.map((warning) => (
            <p className="admin-notice" key={warning}>
              {warning}
            </p>
          ))}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Start</th>
                  <th>Laps</th>
                  <th>Led</th>
                  <th>Inc</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.drivers.map((driver) => (
                  <tr key={`${driver.customerId}-${driver.driver}`}>
                    <td>{driver.position}</td>
                    <td>{driver.driver}</td>
                    <td>{driver.start || '—'}</td>
                    <td>{driver.laps}</td>
                    <td>{driver.lapsLed}</td>
                    <td>{driver.incidents}</td>
                    <td>{driver.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button"
            type="button"
            disabled={!eventId}
            onClick={() => void publish()}
          >
            Publish race results
          </button>
        </div>
      )}
      {lastImport && (
        <div className="admin-upload-success" role="status">
          <span className="admin-upload-success__mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <h3>Race uploaded</h3>
            <p>
              {lastImportedEvent
                ? `Round ${lastImportedEvent.round}: ${lastImportedEvent.track}`
                : 'Results were added to the active season.'}
            </p>
            <small>
              {lastImport.filename} · {new Date(lastImport.importedAt).toLocaleString()}
            </small>
          </div>
        </div>
      )}
      <h3>Published races</h3>
      {publishedSeasons.length ? (
        publishedSeasons.map(({ season, events: publishedEvents }) => (
          <div key={season.id}>
            <h4>{season.name}</h4>
            {publishedEvents.map((item) => (
              <p key={item.id}>
                <strong>
                  Round {item.round}: {item.track}
                </strong>{' '}
                <button type="button" onClick={() => setViewId(item.id)}>
                  Edit Race
                </button>{' '}
                {state.imports.find((entry) => entry.eventId === item.id) ? <button type="button" onClick={async () => setSource(await loadIndyImportSource(state.imports.find((entry) => entry.eventId === item.id)!, state))}>View Original JSON</button> : null}{' '}
                <button
                  className="admin-action--danger"
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        'Delete the published results for this race? The scheduled event will remain.',
                      )
                    )
                      return
                    await mutateIndyAdmin({ action: 'deleteResults', eventId: item.id })
                    if (viewId === item.id) setViewId('')
                    await refresh('Race results deleted. The event is scheduled again.')
                  }}
                >
                  Delete Results
                </button>
              </p>
            ))}
          </div>
        ))
      ) : (
        <p>No published races yet.</p>
      )}
      {viewId && state.results[viewId]?.length ? (
        <RaceEditor
          event={state.schedule.find((item) => item.id === viewId)!}
          rows={state.results[viewId]}
          refresh={refresh}
          close={() => setViewId('')}
        />
      ) : null}
      {source ? <ImportSourceViewer source={source} close={() => setSource(null)} /> : null}
    </AdminSection>
  )
}

const indycarAdminTools: LeagueAdminTool[] = [
  { path: 'seasons', eyebrow: 'Season control', title: 'Seasons', description: 'Create seasons, choose the active season, and manage race timing.' },
  { path: 'points', eyebrow: 'Scoring', title: 'Points', description: 'Configure finishing-position and bonus-point values.' },
  { path: 'schedule', eyebrow: 'Calendar', title: 'Schedule', description: 'Create, reorder, update, and remove scheduled events.' },
  { path: 'results', eyebrow: 'Race control', title: 'Race Results', description: 'Import iRacing results, review race order, penalties, and scoring.' },
]

export function IndycarAdminPage() {
  const { tool } = useParams<{ tool?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<IndyAdminState | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const refresh = async (message = '') => {
    try {
      setState(await loadIndyAdmin())
      setError('')
      setSaved(message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load IndyCar administration.')
      setSaved('')
    }
  }
  useEffect(() => {
    let active = true
    loadIndyAdmin()
      .then((nextState) => {
        if (active) setState(nextState)
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'Could not load IndyCar administration.',
          )
      })
    return () => {
      active = false
    }
  }, [])
  const selectedSeason = useMemo(
    () => state?.seasons.find((item) => item.id === searchParams.get('season')) ?? state?.seasons.find((item) => item.status === 'active') ?? state?.seasons[0],
    [state, searchParams],
  )
  if (tool && !indycarAdminTools.some((item) => item.path === tool)) return <Navigate to="/admin/indycar" replace />
  if (!state)
    return (
      <section className="admin-dashboard">
        <div className="container">
          <p>Loading IndyCar administration…</p>
          <AdminNotice error={error} saved="" />
        </div>
      </section>
    )
  return (
    <section className="admin-dashboard">
      <div className="container">
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">Grassroots Racing Administration</p>
            <h1>Manage IndyCar</h1>
          </div>
          <Link className="button button--secondary" to="/admin">
            Dashboard
          </Link>
        </div>
        {state.seasons.length ? <div className="admin-season-context">
          <div><span>IndyCar</span><strong>{selectedSeason?.name}</strong>{selectedSeason ? <em>{selectedSeason.status}</em> : null}</div>
          <label>Season<select value={selectedSeason?.id ?? ''} onChange={(event) => setSearchParams({ season: event.target.value })}>{state.seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select></label>
        </div> : null}
        {!tool ? <p className="admin-dashboard__intro">Choose a management area. Each tool now has its own focused workspace.</p> : null}
        <LeagueAdminNav basePath="/admin/indycar" leagueName="IndyCar" tools={indycarAdminTools} activeTool={tool} />
        <AdminNotice error={error} saved={saved} />
        {!tool && selectedSeason ? <section className="admin-card admin-card--standalone"><header className="admin-card__standalone-heading"><small>Season overview</small><h2>{selectedSeason.name}</h2></header><div className="admin-season-metrics">
          <div><strong>{new Set(state.schedule.filter((event) => event.seasonId === selectedSeason.id).flatMap((event) => (state.results[event.id] ?? []).map((row) => row.customerId ? `id:${row.customerId}` : `name:${row.driver.toLowerCase()}`))).size}</strong><span>Drivers with results</span></div>
          <div><strong>{state.schedule.filter((event) => event.seasonId === selectedSeason.id).length}</strong><span>Scheduled races</span></div>
          <div><strong>{state.schedule.filter((event) => event.seasonId === selectedSeason.id && event.status === 'completed').length}</strong><span>Completed races</span></div>
        </div></section> : null}
        {tool === 'seasons' ? <SeasonEditor key={selectedSeason?.id} state={state} seasonId={selectedSeason?.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'points' ? <PointsEditor key={`points-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'schedule' ? <ScheduleEditor key={`schedule-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'results' ? <ResultsImporter key={`results-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {tool && tool !== 'seasons' && !selectedSeason ? <p className="admin-notice">Create a season in <Link to="/admin/indycar/seasons">Seasons</Link> before using this tool.</p> : null}
      </div>
    </section>
  )
}

const supremeLeaderFacts = [
  'Carson Hocevar started racing quarter midgets when he was seven years old.',
  'Carson Hocevar is a Michigan native who worked his way through Super Late Models and the NASCAR Truck Series.',
  'Carson Hocevar was born in Portage, Michigan, on January 28, 2003.',
  'Carson Hocevar made his NASCAR Truck Series debut in 2019.',
  'Carson Hocevar earned his first Truck Series victory at Texas in 2023.',
  'Carson Hocevar won four Truck Series races during the 2023 season.',
  'Carson Hocevar reached the Truck Series Championship 4 in 2023.',
  'Carson Hocevar began his first full Cup Series season in 2024 in Spire Motorsports number 77.',
  'Carson Hocevar was named the 2024 NASCAR Cup Series Rookie of the Year.',
  'Carson Hocevar earned his first Cup Series top-five finish at Watkins Glen in 2024.',
  'Portage, Carson Hocevar\'s hometown, is near Kalamazoo in southwest Michigan.',
  'Before moving to Cup, Carson Hocevar raced full-time in the Truck Series for Niece Motorsports.',
  "The Baltimore Orioles take their name from Maryland's orange-and-black state bird.",
  'Oriole Park at Camden Yards opened in 1992 and helped inspire a generation of retro-style ballparks.',
  'The modern Baltimore Orioles began play in 1954 after the St. Louis Browns moved to Baltimore.',
  'The Orioles won World Series championships in 1966, 1970, and 1983.',
  'Baltimore swept the Los Angeles Dodgers in the 1966 World Series.',
  'Cal Ripken Jr. played in 2,632 consecutive games, a Major League record.',
  'Brooks Robinson won 16 consecutive Gold Glove Awards at third base.',
  'Frank Robinson won the American League Triple Crown in 1966.',
  'The 1971 Orioles had four starting pitchers win at least 20 games.',
  'Orange and black have defined the Orioles visual identity for generations.',
  'Hall of Fame manager Earl Weaver led the Orioles for most of the period from 1968 through 1986.',
  'Boog Powell won the American League Most Valuable Player Award in 1970.',
  'National Bohemian was first brewed in Baltimore in 1885.',
  'Mr. Boh, the one-eyed mascot, has represented National Bohemian for generations.',
  'National Bohemian is often called Natty Boh around Baltimore.',
  'The phrase Land of Pleasant Living became one of National Bohemian\'s best-known slogans.',
  'The historic National Brewing Company complex stands in the Brewers Hill neighborhood.',
  'A glowing Mr. Boh sign remains one of the most recognizable sights in the Baltimore skyline.',
  'Mr. Boh first appeared during the 1930s.',
  'National Bohemian is commonly paired with Maryland steamed crabs.',
  'National Brewing introduced Colt 45 malt liquor in 1963.',
  'National Brewing once produced both National Bohemian and Colt 45.',
  'A famous Baltimore billboard shows Mr. Boh proposing to the Utz Girl.',
  'National Bohemian production left Baltimore in the 1990s, but the brand remained a local favorite.',
  "The Baltimore Ravens were named after Edgar Allan Poe's poem “The Raven.”",
  "Purple and black have been the Baltimore Ravens' signature colors since their first season in 1996.",
  'The Baltimore Ravens began play in 1996.',
  'Baltimore fans selected the Ravens name in a public vote.',
  'The Ravens won Super Bowl XXXV and Super Bowl XLVII.',
  'Jonathan Ogden and Ray Lewis were the first two draft picks in Ravens history.',
  'The Ravens moved into their current downtown stadium in 1998.',
  'The 2000 Ravens defense allowed only 165 points during the regular season.',
  'Ray Lewis was named the Most Valuable Player of Super Bowl XXXV.',
  'Joe Flacco was named the Most Valuable Player of Super Bowl XLVII.',
  'John Harbaugh became the Ravens head coach in 2008.',
  'The Ravens colors are purple, black, metallic gold, and white.',
  'Baltimore\'s marching band kept performing even during the years when the city had no NFL team.',
  'The Ravens made their first playoff appearance in 2000 and won the championship that postseason.',
]

const supremeLeaderPositions = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const

function shuffleSupremeLeaderFacts(avoid?: string) {
  const shuffled = [...supremeLeaderFacts]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  if (avoid && shuffled.length > 1 && shuffled[0] === avoid) {
    const first = shuffled[0]
    shuffled[0] = shuffled[1]
    shuffled[1] = first
  }

  return shuffled
}

function SupremeLeaderCorey() {
  const [step, setStep] = useState(0)
  const [factState, setFactState] = useState(() => {
    const deck = shuffleSupremeLeaderFacts()

    return {
      fact: deck.shift() ?? supremeLeaderFacts[0],
      deck,
    }
  })
  const position = supremeLeaderPositions[step % supremeLeaderPositions.length]

  const handleNextFact = () => {
    setFactState((current) => {
      const deck =
        current.deck.length > 0
          ? [...current.deck]
          : shuffleSupremeLeaderFacts(current.fact)

      return {
        fact: deck.shift() ?? supremeLeaderFacts[0],
        deck,
      }
    })
    setStep((currentStep) => currentStep + 1)
  }

  return (
    <aside
      className={`admin-module supreme-leader-card supreme-leader-card--${position}`}
      aria-label="Supreme Leader Corey fun facts"
    >
      <span>Dashboard morale</span>
      <div className="supreme-leader-card__speech" aria-live="polite">
        <strong>Supreme Leader Corey</strong>
        <p>{factState.fact}</p>
      </div>
      <button
        className="supreme-leader-card__trigger"
        type="button"
        onClick={handleNextFact}
        aria-label="Show another Supreme Leader Corey fun fact"
      >
        <img
          className="supreme-leader-card__avatar"
          src="/assets/admin/supreme-leader-corey.webp"
          alt=""
        />
        <span>Another fact →</span>
      </button>
    </aside>
  )
}

export function AdminPage() {
  return (
    <section className="admin-dashboard" aria-labelledby="admin-title">
      <div className="container">
        <p className="eyebrow">Grassroots Racing Administration</p>
        <h1 id="admin-title">Admin Dashboard</h1>
        <div className="admin-dashboard-grid">
          <Link className="admin-module" to="/admin/indycar">
            <span>IndyCar</span>
            <strong>Manage IndyCar</strong>
            <p>Seasons, points, schedule, JSON imports, results, and standings.</p>
            <span className="admin-module__action">Open management →</span>
          </Link>
          <Link className="admin-module" to="/admin/cup">
            <span>Cup Series</span>
            <strong>Manage Cup Series</strong>
            <p>Edit, preview, publish, and restore the Cup Series sporting code.</p>
            <span className="admin-module__action">Open management →</span>
          </Link>
          <Link className="admin-module" to="/admin/gt">
            <span>GT League</span>
            <strong>Manage GT League</strong>
            <p>
              Sporting code, multiclass assignments, teams, class scoring, schedule, race imports,
              results, and standings.
            </p>
            <span className="admin-module__action">Open management →</span>
          </Link>
          <Link className="admin-module" to="/admin/gallery">
            <span>Community</span>
            <strong>Manage Gallery</strong>
            <p>Review, approve, reject, and remove community race photos.</p>
            <span className="admin-module__action">Open moderation →</span>
          </Link>
          <SupremeLeaderCorey />
        </div>
      </div>
    </section>
  )
}
