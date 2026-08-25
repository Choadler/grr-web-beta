import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { SportingCodeAdmin } from '../components/admin/SportingCodeAdmin'
import { LeagueAdminNav, type LeagueAdminTool } from '../components/admin/LeagueAdminNav'
import { CupPenaltyAdmin } from '../components/admin/CupPenaltyAdmin'

const cupAdminTools: LeagueAdminTool[] = [
  { path: 'seasons', eyebrow: 'SimRacerHub history', title: 'Season Manager', description: 'Discover, sync, inspect, and activate Cup seasons.' },
  { path: 'penalties', eyebrow: 'Championship discipline', title: 'Penalty Management', description: 'Manage cumulative points, appeals, and threshold sanctions.' },
  { path: 'sporting-code', eyebrow: 'Published rules', title: 'Sporting Code', description: 'Edit, preview, publish, and restore the Cup Series sporting code.' },
]

type CupSeason = {
  id: string
  srhSeasonId: number
  name: string
  status: string
  lastSyncedAt?: string
  syncStatus: string
  syncError?: string
  chaseEnabled: number
  regularSeasonRaces: number
  chaseSize: number
  maxPointsPerRace: number
}

function CupSeasonFormat({ season, busy, save }: { season: CupSeason; busy: boolean; save: (body: Record<string, unknown>) => void }) {
  const [chaseEnabled, setChaseEnabled] = useState(Boolean(season.chaseEnabled))
  const [regularSeasonRaces, setRegularSeasonRaces] = useState(season.regularSeasonRaces)
  const [chaseSize, setChaseSize] = useState(season.chaseSize)
  const [maxPointsPerRace, setMaxPointsPerRace] = useState(season.maxPointsPerRace)

  return <div className="cup-season-format">
    <div className="cup-season-format__heading">
      <div><p className="eyebrow">Championship format</p><h3>Chase settings</h3></div>
      <label className="cup-season-format__toggle"><input type="checkbox" checked={chaseEnabled} onChange={(event) => setChaseEnabled(event.target.checked)} /><span><strong>{chaseEnabled ? 'Chase enabled' : 'Chase disabled'}</strong><small>Show cutoff, clinch, and Chase indicators</small></span></label>
    </div>
    {chaseEnabled ? <div className="cup-season-format__fields">
      <label><span>Regular-season races</span><small>Races before the Chase begins</small><input type="number" min="1" value={regularSeasonRaces} onChange={(event) => setRegularSeasonRaces(Number(event.target.value))} /></label>
      <label><span>Chase drivers</span><small>Drivers advancing to the Chase</small><input type="number" min="1" value={chaseSize} onChange={(event) => setChaseSize(Number(event.target.value))} /></label>
      <label><span>Max points per race</span><small>Used for clinch calculations</small><input type="number" min="1" value={maxPointsPerRace} onChange={(event) => setMaxPointsPerRace(Number(event.target.value))} /></label>
    </div> : <p className="cup-season-format__disabled-note">Standings will use a full-season championship with no Chase cutoff or clinch indicators.</p>}
    <div className="cup-season-format__footer"><button className="button" type="button" disabled={busy} onClick={() => save({ action: 'configure', seasonId: season.id, chaseEnabled, regularSeasonRaces, chaseSize, maxPointsPerRace })}>{busy ? 'Saving…' : 'Save format'}</button></div>
  </div>
}

function CupSeasonManager() {
  const [seasons, setSeasons] = useState<CupSeason[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const updateSeasons = (next: CupSeason[]) => { setSeasons(next); setSelectedSeasonId((current) => next.some((season) => season.id === current) ? current : next.find((season) => season.status === 'active')?.id ?? next[0]?.id ?? '') }
  useEffect(() => {
    fetch('/admin/api/cup').then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Cup season data is unavailable.')
      setSeasons(payload.seasons ?? [])
      setSelectedSeasonId(payload.seasons?.find((season: CupSeason) => season.status === 'active')?.id ?? payload.seasons?.[0]?.id ?? '')
    }).catch((error) => { setMessageType('error'); setMessage(error instanceof Error ? error.message : 'Cup season data is unavailable.') }).finally(() => setLoading(false))
  }, [])
  const action = async (body: Record<string, unknown>) => { setBusy(true); setMessage(''); try { const response = await fetch('/admin/api/cup', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); updateSeasons(payload.seasons ?? seasons); setMessageType('success'); setMessage(body.action === 'sync' ? `Sync complete: ${payload.result?.races ?? 0} races and ${payload.result?.drivers ?? 0} drivers imported.` : body.action === 'setActive' ? 'The public Cup season was updated.' : body.action === 'configure' ? 'Championship format saved.' : 'Season discovery complete.') } catch (error) { setMessageType('error'); setMessage(error instanceof Error ? error.message : 'Cup update failed.') } finally { setBusy(false) } }
  const selectedSeason = useMemo(() => seasons.find((season) => season.id === selectedSeasonId) ?? seasons[0], [seasons, selectedSeasonId])
  const activeSeason = seasons.find((season) => season.status === 'active')
  const formatSyncTime = (value?: string) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never synced'
  return <section className="cup-season-manager">
    <header className="cup-season-manager__hero"><div><p className="eyebrow">SRH Series 12921</p><h2>Cup Season Manager</h2><p>Choose a season, sync the latest SimRacerHub data, and control which championship is public.</p></div><button className="button" type="button" disabled={busy} onClick={() => action({ action:'discover' })}>{busy ? 'Working…' : 'Discover seasons'}</button></header>
    <div className="cup-season-manager__summary" aria-label="Cup season summary"><div><span>Discovered seasons</span><strong>{loading ? '—' : seasons.length}</strong></div><div><span>Public season</span><strong>{activeSeason?.name ?? 'Not set'}</strong></div><div><span>Data source</span><strong>SimRacerHub</strong><small>Series 12921</small></div></div>
    {message ? <p className={`admin-notice admin-notice--${messageType}`} role="status">{message}</p> : null}
    {loading ? <div className="cup-season-manager__state" role="status"><strong>Loading Cup seasons…</strong><p>Retrieving season and sync status.</p></div> : seasons.length === 0 ? <div className="cup-season-manager__state"><strong>No Cup seasons found</strong><p>Discover seasons to import the available SimRacerHub championships.</p><button className="button" type="button" disabled={busy} onClick={() => action({ action:'discover' })}>Discover seasons</button></div> : <div className="cup-season-workspace">
      <aside className="cup-season-browser" aria-label="Cup seasons"><div className="cup-season-browser__heading"><div><p className="eyebrow">Season library</p><h3>Choose a season</h3></div><span>{seasons.length}</span></div><div className="cup-season-browser__list">{seasons.map((season) => <button className={`cup-season-option${season.id === selectedSeason?.id ? ' is-selected' : ''}`} type="button" onClick={() => setSelectedSeasonId(season.id)} key={season.id} aria-pressed={season.id === selectedSeason?.id}><span className="cup-season-option__top"><strong>{season.name}</strong>{season.status === 'active' ? <span className="admin-season-status admin-season-status--active">Public</span> : null}</span><span className="cup-season-option__meta">SRH {season.srhSeasonId}<span aria-hidden="true">·</span>{season.syncStatus}</span><small>{formatSyncTime(season.lastSyncedAt)}</small></button>)}</div><p className="cup-season-browser__help">Discovery finds seasons. Sync imports schedules, results, standings, and drivers.</p></aside>
      {selectedSeason ? <article className="cup-season-editor"><header className="cup-season-editor__heading"><div><div className="cup-season-editor__status"><span className={`admin-season-status ${selectedSeason.status === 'active' ? 'admin-season-status--active' : 'admin-season-status--draft'}`}>{selectedSeason.status === 'active' ? 'Public season' : 'Inactive'}</span><span>SRH {selectedSeason.srhSeasonId}</span></div><h3>{selectedSeason.name}</h3><p>Last synced: {formatSyncTime(selectedSeason.lastSyncedAt)}</p></div><div className="cup-season-editor__actions"><button className="button button--secondary" type="button" disabled={busy} onClick={() => action({action:'sync',srhSeasonId:selectedSeason.srhSeasonId})}>{busy ? 'Syncing…' : 'Sync season'}</button>{selectedSeason.status !== 'active' ? <button className="button" type="button" disabled={busy} onClick={() => { if (confirm(`Make ${selectedSeason.name} the public Cup season?`)) action({action:'setActive',seasonId:selectedSeason.id}) }}>Set as public</button> : null}</div></header>{selectedSeason.syncError ? <p className="admin-notice admin-notice--error"><strong>Last sync failed.</strong> {selectedSeason.syncError}</p> : null}<CupSeasonFormat key={`${selectedSeason.id}-${selectedSeason.chaseEnabled}-${selectedSeason.regularSeasonRaces}-${selectedSeason.chaseSize}-${selectedSeason.maxPointsPerRace}`} season={selectedSeason} busy={busy} save={action} /></article> : null}
    </div>}
  </section>
}

export function CupAdminPage() {
  const { tool } = useParams<{ tool?: string }>()
  if (tool && !['sporting-code','seasons','penalties'].includes(tool)) return <Navigate to="/admin/cup" replace />
  return <section className="admin-dashboard">
    <div className="container">
      <div className="admin-page-heading">
        <div><p className="eyebrow">Grassroots Racing Administration</p><h1>Manage Cup Series</h1></div>
        <Link className="button button--secondary" to="/admin">Dashboard</Link>
      </div>
      {!tool ? <p className="admin-dashboard__intro">Choose a management area. Each tool now has its own focused workspace.</p> : null}
      <LeagueAdminNav basePath="/admin/cup" leagueName="Cup Series" tools={cupAdminTools} activeTool={tool} />
      {tool === 'seasons' ? <CupSeasonManager /> : null}
      {tool === 'penalties' ? <CupPenaltyAdmin /> : null}
      {tool === 'sporting-code' ? <SportingCodeAdmin league="cup" /> : null}
    </div>
  </section>
}
