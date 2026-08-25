import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { loadCupPenaltyAdmin, updateCupPenalties } from '../../services/cupPenalties'
import type { CupPenalty, CupPenaltyAdminPayload, CupPenaltyReport, CupPenaltyStatus, CupPenaltyType, CupSanction } from '../../types/cupPenalties'

const typeLabels: Record<CupPenaltyType, string> = { AT_FAULT_INCIDENT: 'At-Fault Incident', CLEAN_RACE: 'Clean Race', ADMIN_ADJUSTMENT: 'Administrative Adjustment', APPEAL_ADJUSTMENT: 'Appeal Adjustment', SUSPENSION_REDUCTION: 'Suspension Reduction', OTHER: 'Other' }
const sanctionLabels = { QUALIFYING_BAN: 'Qualifying Ban / Rear of Field', RACE_SUSPENSION: 'One-Race Suspension' }
const levelLabels = { CLEAR: 'Clear', ACTIVE: 'Active', QUALIFYING_BAN_THRESHOLD: 'Qualifying Ban Threshold', SUSPENSION_THRESHOLD: 'Suspension Threshold' }
const pointText = (value: number) => `${value > 0 ? '+' : ''}${value}`
const eventLabel = (event: CupPenaltyReport['events'][number]) => `Round ${event.round} — ${event.track || event.eventName || 'Event'}${event.date ? ` — ${new Date(`${event.date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`

function PenaltyForm({ report, save, busy }: { report: CupPenaltyReport; save: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [driverSearch, setDriverSearch] = useState(''), [eventSearch, setEventSearch] = useState('')
  const [type, setType] = useState<CupPenaltyType>('AT_FAULT_INCIDENT'), [adjustment, setAdjustment] = useState(3)
  const [description, setDescription] = useState(''), [status, setStatus] = useState<CupPenaltyStatus>('ACTIVE'), [note, setNote] = useState('')
  const preset = (value: CupPenaltyType) => { setType(value); if (value === 'AT_FAULT_INCIDENT') setAdjustment(3); if (value === 'CLEAN_RACE') setAdjustment(-1) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const driver = report.drivers.find((item) => `${item.name} — ${item.id}` === driverSearch)
    const selectedEvent = report.events.find((item) => eventLabel(item) === eventSearch)
    await save({ action: 'createPenalty', seasonId: report.season.id, driverId: driver?.id, eventId: selectedEvent?.id || '', type, adjustment, description, status, appealNote: status === 'UNDER_APPEAL' ? note : '', adminNote: status !== 'UNDER_APPEAL' ? note : '' })
    setDescription(''); setNote('')
  }
  return <section className="cup-penalty-panel" aria-labelledby="add-penalty-title"><header><p className="eyebrow">Ledger entry</p><h2 id="add-penalty-title">Add Penalty</h2></header>
    <div className="cup-penalty-presets"><button type="button" onClick={() => preset('AT_FAULT_INCIDENT')}>At-Fault Incident +3</button><button type="button" onClick={() => preset('CLEAN_RACE')}>Clean Race −1</button></div>
    <form className="cup-penalty-form" onSubmit={submit}><label><span>Season</span><input value={report.season.name} disabled /></label>
      <label><span>Driver</span><input required list="cup-penalty-drivers" value={driverSearch} onChange={(event) => setDriverSearch(event.target.value)} placeholder="Search known drivers" /><datalist id="cup-penalty-drivers">{report.drivers.map((driver) => <option key={driver.id} value={`${driver.name} — ${driver.id}`} />)}</datalist></label>
      <label><span>Event</span><input list="cup-penalty-events" value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder="Search scheduled events" /><datalist id="cup-penalty-events">{report.events.map((item) => <option key={item.id} value={eventLabel(item)} />)}</datalist></label>
      <label><span>Penalty Type</span><select value={type} onChange={(event) => preset(event.target.value as CupPenaltyType)}>{Object.entries(typeLabels).filter(([key]) => key !== 'SUSPENSION_REDUCTION').map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label><span>Point Adjustment</span><input required type="number" value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} /></label>
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as CupPenaltyStatus)}><option value="ACTIVE">Active</option><option value="UNDER_APPEAL">Under Appeal</option><option value="OVERTURNED">Overturned</option></select></label>
      <label className="is-wide"><span>Public Description</span><textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
      <label className="is-wide"><span>Appeal / Admin Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} /></label>
      <div className="is-wide cup-penalty-form__actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Add Ledger Entry'}</button></div>
    </form>
  </section>
}

function SanctionRow({ sanction, report, act, busy }: { sanction: CupSanction; report: CupPenaltyReport; act: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [targetEventId, setTargetEventId] = useState(sanction.targetEventId ?? ''), [notes, setNotes] = useState(sanction.adminNotes ?? '')
  const update = (status: 'PENDING' | 'SERVED' | 'WAIVED') => act({ action: 'updateSanction', seasonId: report.season.id, sanctionId: sanction.id, status, targetEventId, adminNotes: notes })
  return <article className={`cup-sanction-card cup-sanction-card--${sanction.status.toLowerCase()}`}><div><span>{sanction.status}</span><h3>{sanctionLabels[sanction.type]}</h3><p><strong>{sanction.driver}</strong> · Triggered at {sanction.triggeringBalance} points</p></div>
    {sanction.status === 'PENDING' ? <div className="cup-sanction-card__controls"><select aria-label="Assigned event" value={targetEventId} onChange={(event) => setTargetEventId(event.target.value)}><option value="">Next event / not assigned</option>{report.events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}</select><input aria-label="Sanction notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Admin notes" /><button className="button button--secondary" disabled={busy} onClick={() => update('PENDING')}>Assign Event</button><button className="button" disabled={busy} onClick={() => update('SERVED')}>Mark Served</button><button className="button button--secondary" disabled={busy} onClick={() => update('WAIVED')}>Waive / Overturn</button></div> : <p>{sanction.targetEventName || 'No target event assigned'}{sanction.adminNotes ? ` · ${sanction.adminNotes}` : ''}</p>}
  </article>
}

function LedgerActions({ penalty, seasonId, act, busy }: { penalty: CupPenalty; seasonId: string; act: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const update = (status: CupPenaltyStatus) => { const appealNote = status === 'OVERTURNED' ? prompt('Appeal result / reason for overturning:', penalty.appealNote ?? '') : penalty.appealNote; if (status === 'OVERTURNED' && appealNote === null) return; void act({ action: 'updatePenalty', seasonId, penaltyId: penalty.id, status, appealNote: appealNote ?? '', adminNote: penalty.adminNote ?? '' }) }
  const edit = () => { const value = prompt('Point adjustment:', String(penalty.adjustment)); if (value === null) return; const description = prompt('Public description:', penalty.description); if (description === null) return; void act({ action: 'updatePenalty', seasonId, penaltyId: penalty.id, adjustment: Number(value), description, status: penalty.status, appealNote: penalty.appealNote ?? '', adminNote: penalty.adminNote ?? '' }) }
  if (penalty.systemGenerated) return <span>System entry</span>
  return <div className="cup-ledger-actions"><button disabled={busy} onClick={edit}>Edit</button>{penalty.status === 'ACTIVE' && <button disabled={busy} onClick={() => update('UNDER_APPEAL')}>Mark Under Appeal</button>}{penalty.status !== 'OVERTURNED' && <button disabled={busy} onClick={() => update('OVERTURNED')}>Overturn</button>}{penalty.status === 'OVERTURNED' && <button disabled={busy} onClick={() => update('ACTIVE')}>Reinstate</button>}</div>
}

export function CupPenaltyAdmin() {
  const [payload, setPayload] = useState<CupPenaltyAdminPayload | null>(null), [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  useEffect(() => { const controller = new AbortController(); loadCupPenaltyAdmin(selectedSeasonId, controller.signal).then((value) => { setPayload(value); setSelectedSeasonId(value.report?.season.id ?? value.seasons[0]?.id ?? '') }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Cup penalties are unavailable.')); return () => controller.abort() }, [selectedSeasonId])
  const act = async (body: Record<string, unknown>) => { setBusy(true); setError(''); setMessage(''); try { const report = await updateCupPenalties(body); setPayload((current) => current ? { ...current, report } : current); setMessage('Cup penalty records updated.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cup penalty update failed.') } finally { setBusy(false) } }
  const report = payload?.report
  const selectedHistory = useMemo(() => report?.penalties.filter((item) => item.driverId === selectedDriverId).slice().reverse() ?? [], [report, selectedDriverId])
  if (!payload) return <div className="cup-season-manager__state" role="status"><strong>Loading Cup penalties…</strong></div>
  if (!report) return <div className="cup-season-manager__state"><strong>No Cup seasons found</strong><p>Discover and sync a Cup season before entering penalties.</p></div>
  return <div className="cup-penalty-admin"><header className="cup-penalty-admin__hero"><div><p className="eyebrow">Championship discipline</p><h2>Penalty Management</h2><p>Manage the permanent Cup penalty ledger, appeals, and threshold sanctions.</p></div><label><span>Season</span><select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)}>{payload.seasons.map((season) => <option value={season.id} key={season.id}>{season.name}{season.status === 'active' ? ' — Public' : ''}</option>)}</select></label></header>
    {message && <p className="admin-notice admin-notice--success" role="status">{message}</p>}{error && <p className="admin-notice admin-notice--error" role="alert">{error}</p>}
    <section className="cup-penalty-panel"><header><p className="eyebrow">Current balances</p><h2>Driver Penalty Summary</h2></header>{report.summaries.length ? <div className="admin-table-wrap"><table className="admin-table cup-penalty-table"><thead><tr><th>Driver</th><th>Penalty Points</th><th>Status</th><th>Pending Sanction</th><th>Last Penalty</th><th>Actions</th></tr></thead><tbody>{report.summaries.map((item) => <tr key={item.driverId}><th scope="row">{item.driver}</th><td><strong>{item.balance}</strong></td><td><span className={`cup-penalty-badge cup-penalty-badge--${item.level.toLowerCase()}`}>{levelLabels[item.level]}</span></td><td>{item.pendingSanctions.map((sanction) => sanctionLabels[sanction.type]).join(', ') || '—'}</td><td>{item.lastPenalty?.eventName ?? '—'}</td><td><button onClick={() => setSelectedDriverId(item.driverId)}>View</button></td></tr>)}</tbody></table></div> : <p className="cup-penalty-empty">No penalties have been entered for this season.</p>}</section>
    {selectedDriverId !== null && <section className="cup-penalty-panel"><header><p className="eyebrow">Driver detail</p><h2>{report.summaries.find((item) => item.driverId === selectedDriverId)?.driver}</h2><button type="button" onClick={() => setSelectedDriverId(null)}>Close</button></header><div className="cup-driver-ledger">{selectedHistory.map((item) => <article key={item.id}><span>{item.eventRound ? `Round ${item.eventRound} — ` : ''}{item.eventName}</span><strong>{typeLabels[item.type]} <b>{pointText(item.adjustment)}</b></strong><p>{item.description}</p><small>{item.status.replaceAll('_', ' ')} · Running total: {item.runningTotal}</small></article>)}</div></section>}
    <section className="cup-penalty-panel"><header><p className="eyebrow">Required action</p><h2>Pending Sanctions</h2></header><div className="cup-sanction-list">{report.sanctions.filter((item) => item.status === 'PENDING').map((item) => <SanctionRow key={item.id} sanction={item} report={report} act={act} busy={busy} />)}{!report.sanctions.some((item) => item.status === 'PENDING') && <p className="cup-penalty-empty">No pending sanctions.</p>}</div></section>
    <PenaltyForm report={report} save={act} busy={busy} />
    <section className="cup-penalty-panel"><header><p className="eyebrow">Permanent record</p><h2>Penalty History / Ledger</h2></header>{report.penalties.length ? <div className="admin-table-wrap"><table className="admin-table cup-penalty-table"><thead><tr><th>Date Entered</th><th>Event</th><th>Driver</th><th>Type</th><th>Adjustment</th><th>Status</th><th>Description</th><th>Admin Actions</th></tr></thead><tbody>{report.penalties.map((item) => <tr className={item.status === 'OVERTURNED' ? 'is-overturned' : ''} key={item.id}><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.eventName}</td><td>{item.driver}</td><td>{typeLabels[item.type]}</td><td className={item.adjustment > 0 ? 'is-positive' : 'is-negative'}>{pointText(item.adjustment)}</td><td>{item.status.replaceAll('_', ' ')}</td><td><p>{item.description}</p>{item.appealNote && <small>{item.appealNote}</small>}</td><td><LedgerActions penalty={item} seasonId={report.season.id} act={act} busy={busy} /></td></tr>)}</tbody></table></div> : <p className="cup-penalty-empty">No penalties have been entered for this season.</p>}</section>
  </div>
}
