import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { SportingCodeAdmin } from '../components/admin/SportingCodeAdmin'
import { LeagueAdminNav, type LeagueAdminTool } from '../components/admin/LeagueAdminNav'

const cupAdminTools: LeagueAdminTool[] = [
  { path: 'seasons', eyebrow: 'SimRacerHub history', title: 'Season Manager', description: 'Discover, sync, inspect, and activate Cup seasons.' },
  { path: 'sporting-code', eyebrow: 'Published rules', title: 'Sporting Code', description: 'Edit, preview, publish, and restore the Cup Series sporting code.' },
]

type CupSeason = { id: string; srhSeasonId: number; name: string; status: string; lastSyncedAt?: string; syncStatus: string; syncError?: string }
function CupSeasonManager() {
  const [seasons, setSeasons] = useState<CupSeason[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => fetch('/admin/api/cup').then((response) => response.json()).then((payload) => setSeasons(payload.seasons ?? []))
  useEffect(() => { load().catch(() => setMessage('Cup season data is unavailable.')) }, [])
  const action = async (body: Record<string, unknown>) => { setBusy(true); setMessage(''); try { const response = await fetch('/admin/api/cup', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setSeasons(payload.seasons ?? seasons); setMessage(body.action === 'sync' ? `Synced ${payload.result?.races ?? 0} races and ${payload.result?.drivers ?? 0} drivers.` : 'Cup seasons updated.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Cup update failed.') } finally { setBusy(false) } }
  return <section className="admin-panel"><div className="admin-section-heading"><div><p className="eyebrow">SRH Series 12921</p><h2>Cup Season Manager</h2></div><button className="button" disabled={busy} onClick={() => action({ action:'discover' })}>Discover SRH Seasons</button></div>
    <p className="data-note">Discovery reads the SRH season index. Syncing imports normalized schedules, race and stage results, standings, and driver identities into D1.</p>
    <div className="admin-list">{seasons.map((season)=><article className="admin-list-row" key={season.id}><div><strong>{season.name}</strong><p>SRH {season.srhSeasonId} · {season.syncStatus}{season.lastSyncedAt ? ` · ${new Date(season.lastSyncedAt).toLocaleString()}` : ''}</p>{season.syncError && <p>{season.syncError}</p>}</div><div className="admin-actions"><button className="button button--secondary" disabled={busy} onClick={() => action({action:'sync',srhSeasonId:season.srhSeasonId})}>Sync</button>{season.status !== 'active' && <button className="button button--secondary" disabled={busy} onClick={() => action({action:'setActive',seasonId:season.id})}>Set Active</button>}</div></article>)}</div>{message && <p role="status">{message}</p>}
  </section>
}

export function CupAdminPage() {
  const { tool } = useParams<{ tool?: string }>()
  if (tool && !['sporting-code','seasons'].includes(tool)) return <Navigate to="/admin/cup" replace />
  return <section className="admin-dashboard">
    <div className="container">
      <div className="admin-page-heading">
        <div><p className="eyebrow">Grassroots Racing Administration</p><h1>Manage Cup Series</h1></div>
        <Link className="button button--secondary" to="/admin">Dashboard</Link>
      </div>
      {!tool ? <p className="admin-dashboard__intro">Choose a management area. Each tool now has its own focused workspace.</p> : null}
      <LeagueAdminNav basePath="/admin/cup" leagueName="Cup Series" tools={cupAdminTools} activeTool={tool} />
      {tool === 'seasons' ? <CupSeasonManager /> : null}
      {tool === 'sporting-code' ? <SportingCodeAdmin league="cup" /> : null}
    </div>
  </section>
}
