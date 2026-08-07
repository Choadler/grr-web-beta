import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadIndyAdmin, mutateIndyAdmin, defaultIndyPoints } from '../services/indycarAdmin'
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

function RaceEditor({ event, rows, refresh, close }: { event: IndyScheduledEvent; rows: IndyManagedResult[]; refresh: (message?: string) => Promise<void>; close: () => void }) {
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
      <div className="admin-race-editor__heading"><div><p className="eyebrow">Race review</p><h3>Round {event.round}: {event.track}</h3></div><button className="button button--compact button--secondary" type="button" onClick={close}>Close race</button></div>
      <p>Drag drivers into order, use the move buttons for keyboard control, and enter penalty-point deductions before rescoring.</p>
      <div className="admin-table-wrap"><table className="admin-table admin-results-editor"><thead><tr><th>Order</th><th>Pos</th><th>Driver</th><th>Start</th><th>Race Pts</th><th>Bonus</th><th>Penalty</th><th>Total</th></tr></thead><tbody>{results.map((driver, index) => <tr key={driver.id ?? `${driver.customerId}-${driver.driver}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) move(dragIndex, index); setDragIndex(null) }}><td><span className="drag-handle" title="Drag to reorder" aria-hidden="true">↕</span><button type="button" aria-label={`Move ${driver.driver} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button><button type="button" aria-label={`Move ${driver.driver} down`} disabled={index === results.length - 1} onClick={() => move(index, index + 1)}>↓</button></td><td>{index + 1}</td><td>{driver.driver}</td><td>{driver.start || '-'}</td><td>{driver.racePoints}</td><td>{driver.bonus}</td><td><input aria-label={`Penalty points for ${driver.driver}`} type="number" min="0" value={driver.penalty} onChange={(event) => setResults(results.map((row, rowIndex) => rowIndex === index ? { ...row, penalty: Math.max(0, Number(event.target.value) || 0) } : row))} /></td><td>{driver.racePoints + driver.bonus - driver.penalty}</td></tr>)}</tbody></table></div>
      <button className="button" type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Rescoring…' : 'Save & rescore race'}</button>
    </div>
  )
}

type AdminSectionControl = {
  open: boolean
  onToggle: (open: boolean) => void
}

function AdminSection({ eyebrow, title, summary, open, onToggle, children }: { eyebrow: string; title: string; summary?: string; children: React.ReactNode } & AdminSectionControl) {
  return (
    <details className="admin-card admin-card--collapsible" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <span><small>{eyebrow}</small><strong>{title}</strong>{!open && summary ? <span className="admin-card__summary">{summary}</span> : null}</span>
        <span className="admin-card__toggle" aria-hidden="true">Open</span>
      </summary>
      <div className="admin-card__content">{children}</div>
    </details>
  )
}

function SeasonEditor({ state, refresh, ...section }: { state: IndyAdminState; refresh: (message?: string) => Promise<void> } & AdminSectionControl) {
  const [season, setSeason] = useState<IndySeason>(state.seasons.find((item) => item.status === 'active') ?? state.seasons[0] ?? newSeason())
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    await mutateIndyAdmin({ action: 'saveSeason', season })
    await refresh('Season saved.')
    setBusy(false)
  }
  return (
    <AdminSection eyebrow="Season control" title="IndyCar season" {...section}>
      {state.seasons.length > 0 && (
        <label>Season<select value={season.id} onChange={(event) => setSeason(state.seasons.find((item) => item.id === event.target.value) ?? newSeason())}>{state.seasons.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.status})</option>)}<option value="">Create new season</option></select></label>
      )}
      <div className="admin-form-grid">
        <label>Season name<input value={season.name} onChange={(event) => setSeason({ ...season, name: event.target.value })} /></label>
        <label>Status<select value={season.status} onChange={(event) => setSeason({ ...season, status: event.target.value as IndySeason['status'] })}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
        <label>Race time<input type="time" value={season.raceTime} onChange={(event) => setSeason({ ...season, raceTime: event.target.value })} /></label>
        <label>Time zone<input value={season.timezone} onChange={(event) => setSeason({ ...season, timezone: event.target.value })} /></label>
      </div>
      <button className="button" type="button" disabled={busy || !season.name} onClick={() => void save()}>{busy ? 'Saving…' : 'Save season'}</button>
    </AdminSection>
  )
}

function PointsEditor({ state, seasonId, refresh, ...section }: { state: IndyAdminState; seasonId: string; refresh: (message?: string) => Promise<void> } & AdminSectionControl) {
  const [config, setConfig] = useState<IndyPointsConfig>(state.points[seasonId] ?? defaultIndyPoints)
  const updatePosition = (index: number, points: number) => setConfig({ ...config, positions: config.positions.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, points } : rule) })
  const save = async () => { await mutateIndyAdmin({ action: 'savePoints', seasonId, points: config }); await refresh('Points table saved.') }
  return (
    <AdminSection eyebrow="Scoring" title="Points table" {...section}>
      <div className="admin-card__actions"><button className="button button--compact" type="button" onClick={() => setConfig(defaultIndyPoints)}>Reset draft</button></div>
      <div className="admin-form-grid admin-form-grid--bonuses">
        <label>Pole bonus<input type="number" min="0" value={config.poleBonus} onChange={(event) => setConfig({ ...config, poleBonus: Number(event.target.value) })} /></label>
        <label>Lead a lap bonus<input type="number" min="0" value={config.lapLedBonus} onChange={(event) => setConfig({ ...config, lapLedBonus: Number(event.target.value) })} /></label>
        <label>Most laps led bonus<input type="number" min="0" value={config.mostLapsLedBonus} onChange={(event) => setConfig({ ...config, mostLapsLedBonus: Number(event.target.value) })} /></label>
      </div>
      <div className="points-grid">{config.positions.map((rule, index) => <label key={rule.position}><span>P{rule.position}</span><input aria-label={`Points for position ${rule.position}`} type="number" min="0" value={rule.points} onChange={(event) => updatePosition(index, Number(event.target.value))} /></label>)}</div>
      <button className="button" type="button" onClick={() => void save()}>Save points table</button>
    </AdminSection>
  )
}

function ScheduleEditor({ state, seasonId, refresh, ...section }: { state: IndyAdminState; seasonId: string; refresh: (message?: string) => Promise<void> } & AdminSectionControl) {
  const seasonEvents = state.schedule.filter((event) => event.seasonId === seasonId).sort((a, b) => a.round - b.round)
  const completedCount = seasonEvents.filter((event) => event.status === 'completed').length
  const scheduledCount = seasonEvents.filter((event) => event.status === 'scheduled').length
  const scheduleSummary = `${completedCount} completed · ${scheduledCount} scheduled · ${seasonEvents.length} total`
  const blank = (): IndyScheduledEvent => ({ id: id(), seasonId, round: seasonEvents.length + 1, date: '', track: '', laps: 0, status: 'scheduled' })
  const [event, setEvent] = useState<IndyScheduledEvent>(blank())
  const [viewEventId, setViewEventId] = useState('')
  const save = async () => { await mutateIndyAdmin({ action: 'saveEvent', event }); setEvent(blank()); await refresh('Schedule updated.') }
  const remove = async (eventId: string) => { if (!confirm('Remove this scheduled event?')) return; await mutateIndyAdmin({ action: 'deleteEvent', eventId }); await refresh('Event removed.') }
  const deleteResults = async (eventId: string) => {
    if (!confirm('Delete the published results for this race? The scheduled event will remain.')) return
    await mutateIndyAdmin({ action: 'deleteResults', eventId })
    if (viewEventId === eventId) setViewEventId('')
    await refresh('Race results deleted. The event is scheduled again.')
  }
  return (
    <AdminSection eyebrow="Calendar" title="Schedule" summary={scheduleSummary} {...section}>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Round</th><th>Date</th><th>Track</th><th>Laps</th><th>Status</th><th>Actions</th></tr></thead><tbody>{seasonEvents.length ? seasonEvents.map((item) => { const hasResults = Boolean(state.results[item.id]?.length); return <tr key={item.id}><td>{item.round}</td><td>{item.date}</td><td>{item.track}</td><td>{item.laps}</td><td>{item.status}</td><td>{hasResults && <><button type="button" onClick={() => setViewEventId(item.id)}>Edit Race</button> <button className="admin-action--danger" type="button" onClick={() => void deleteResults(item.id)}>Delete Results</button> </>}<button type="button" onClick={() => void remove(item.id)}>Remove</button></td></tr> }) : <tr><td colSpan={6}>No scheduled events yet.</td></tr>}</tbody></table></div>
      {viewEventId && state.results[viewEventId]?.length ? <RaceEditor key={viewEventId} event={seasonEvents.find((item) => item.id === viewEventId)!} rows={state.results[viewEventId]} refresh={refresh} close={() => setViewEventId('')} /> : null}
      <h3>{seasonEvents.some((item) => item.id === event.id) ? 'Edit event' : 'Add event'}</h3>
      <div className="admin-form-grid">
        <label>Round<input type="number" min="1" value={event.round} onChange={(e) => setEvent({ ...event, round: Number(e.target.value) })} /></label>
        <label>Date<input type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} /></label>
        <label>Track<input value={event.track} onChange={(e) => setEvent({ ...event, track: e.target.value })} /></label>
        <label>Laps<input type="number" min="1" value={event.laps || ''} onChange={(e) => setEvent({ ...event, laps: Number(e.target.value) })} /></label>
      </div>
      <button className="button" type="button" disabled={!event.date || !event.track || !event.laps} onClick={() => void save()}>Save event</button>
    </AdminSection>
  )
}

function ResultsImporter({ state, seasonId, refresh, ...section }: { state: IndyAdminState; seasonId: string; refresh: (message?: string) => Promise<void> } & AdminSectionControl) {
  const [preview, setPreview] = useState<IndyImportPreview | null>(null)
  const [rawJson, setRawJson] = useState<unknown>(null)
  const [filename, setFilename] = useState('')
  const [eventId, setEventId] = useState('')
  const [error, setError] = useState('')
  const events = state.schedule.filter((item) => item.seasonId === seasonId)
  const lastImport = state.imports.filter((item) => item.seasonId === seasonId).at(-1)
  const lastImportedEvent = events.find((item) => item.id === lastImport?.eventId)
  const read = async (file?: File) => {
    if (!file) return
    try { const payload: unknown = JSON.parse(await file.text()); setRawJson(payload); setPreview(parseIndycarResultJson(payload)); setFilename(file.name); setError('') } catch (reason) { setRawJson(null); setPreview(null); setError(reason instanceof Error ? reason.message : 'Could not read that JSON file.') }
  }
  const publish = async () => {
    if (!preview || !eventId) return
    await mutateIndyAdmin({ action: 'publishResults', seasonId, eventId, preview, rawJson, filename })
    setPreview(null); setRawJson(null); setFilename(''); setEventId(''); await refresh('Race results published and standings recalculated.')
  }
  return (
    <AdminSection eyebrow="Race control" title="Import Race" {...section}>
      <p>The original JSON is retained for auditing. Nothing is published until you review the preview and assign it to a scheduled event.</p>
      <label className="json-drop">Race results JSON<input type="file" accept="application/json,.json" onChange={(event) => void read(event.target.files?.[0])} /></label>
      {error && <p className="admin-notice admin-notice--error">{error}</p>}
      {preview && <div className="import-preview"><div className="import-preview__summary"><div><strong>{preview.track}</strong><span>{preview.drivers.length} drivers · Subsession {preview.subsessionId ?? 'not found'}</span></div><label>Scheduled event<select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">Select event…</option>{events.map((item) => <option key={item.id} value={item.id}>Round {item.round}: {item.track} — {item.date}</option>)}</select></label></div>{preview.warnings.map((warning) => <p className="admin-notice" key={warning}>{warning}</p>)}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pos</th><th>Driver</th><th>Start</th><th>Laps</th><th>Led</th><th>Inc</th><th>Status</th></tr></thead><tbody>{preview.drivers.map((driver) => <tr key={`${driver.customerId}-${driver.driver}`}><td>{driver.position}</td><td>{driver.driver}</td><td>{driver.start || '—'}</td><td>{driver.laps}</td><td>{driver.lapsLed}</td><td>{driver.incidents}</td><td>{driver.status}</td></tr>)}</tbody></table></div><button className="button" type="button" disabled={!eventId} onClick={() => void publish()}>Publish race results</button></div>}
      {lastImport && (
        <div className="admin-upload-success" role="status">
          <span className="admin-upload-success__mark" aria-hidden="true">✓</span>
          <div>
            <h3>Race uploaded</h3>
            <p>{lastImportedEvent ? `Round ${lastImportedEvent.round}: ${lastImportedEvent.track}` : 'Results were added to the active season.'}</p>
            <small>{lastImport.filename} · {new Date(lastImport.importedAt).toLocaleString()}</small>
          </div>
        </div>
      )}
    </AdminSection>
  )
}

export function IndycarAdminPage() {
  const [state, setState] = useState<IndyAdminState | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [openSection, setOpenSection] = useState('season')
  const section = (name: string): AdminSectionControl => ({
    open: openSection === name,
    onToggle: (open) => setOpenSection(open ? name : (current) => current === name ? '' : current),
  })
  const refresh = async (message = '') => { try { setState(await loadIndyAdmin()); setError(''); setSaved(message) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load IndyCar administration.'); setSaved('') } }
  useEffect(() => {
    let active = true
    loadIndyAdmin()
      .then((nextState) => { if (active) setState(nextState) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load IndyCar administration.') })
    return () => { active = false }
  }, [])
  const activeSeason = useMemo(() => state?.seasons.find((item) => item.status === 'active') ?? state?.seasons[0], [state])
  if (!state) return <section className="admin-dashboard"><div className="container"><p>Loading IndyCar administration…</p><AdminNotice error={error} saved="" /></div></section>
  return <section className="admin-dashboard"><div className="container"><div className="admin-page-heading"><div><p className="eyebrow">Grassroots Racing Administration</p><h1>Manage IndyCar</h1></div><Link className="button button--secondary" to="/admin">Dashboard</Link></div><AdminNotice error={error} saved={saved} /><SeasonEditor state={state} refresh={refresh} {...section('season')} />{activeSeason ? <><PointsEditor key={`points-${activeSeason.id}`} state={state} seasonId={activeSeason.id} refresh={refresh} {...section('points')} /><ScheduleEditor key={`schedule-${activeSeason.id}`} state={state} seasonId={activeSeason.id} refresh={refresh} {...section('schedule')} /><ResultsImporter key={`results-${activeSeason.id}`} state={state} seasonId={activeSeason.id} refresh={refresh} {...section('import')} /></> : <p className="admin-notice">Create a season before configuring its points, schedule, and results.</p>}</div></section>
}

export function AdminPage() {
  return <section className="admin-dashboard" aria-labelledby="admin-title"><div className="container"><p className="eyebrow">Grassroots Racing Administration</p><h1 id="admin-title">Admin Dashboard</h1><div className="admin-dashboard-grid"><Link className="admin-module" to="/admin/indycar"><span>IndyCar</span><strong>Manage IndyCar</strong><p>Seasons, points, schedule, JSON imports, results, and standings.</p><span className="admin-module__action">Open management →</span></Link><div className="admin-module admin-module--disabled"><span>Future</span><strong>Cup Series</strong><p>In-house scoring will follow the IndyCar pilot.</p></div><Link className="admin-module" to="/admin/gt"><span>GT League</span><strong>Manage GT League</strong><p>Multiclass assignments, teams, class scoring, schedule, race imports, results, and standings.</p><span className="admin-module__action">Open management →</span></Link><Link className="admin-module" to="/admin/gallery"><span>Community</span><strong>Manage Gallery</strong><p>Review, approve, reject, and remove community race photos.</p><span className="admin-module__action">Open moderation →</span></Link></div></div></section>
}
