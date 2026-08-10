import { Link, Navigate, useParams } from 'react-router-dom'
import { SportingCodeAdmin } from '../components/admin/SportingCodeAdmin'
import { LeagueAdminNav, type LeagueAdminTool } from '../components/admin/LeagueAdminNav'

const cupAdminTools: LeagueAdminTool[] = [
  { path: 'sporting-code', eyebrow: 'Published rules', title: 'Sporting Code', description: 'Edit, preview, publish, and restore the Cup Series sporting code.' },
]

export function CupAdminPage() {
  const { tool } = useParams<{ tool?: string }>()
  if (tool && tool !== 'sporting-code') return <Navigate to="/admin/cup" replace />
  return <section className="admin-dashboard">
    <div className="container">
      <div className="admin-page-heading">
        <div><p className="eyebrow">Grassroots Racing Administration</p><h1>Manage Cup Series</h1></div>
        <Link className="button button--secondary" to="/admin">Dashboard</Link>
      </div>
      {!tool ? <p className="admin-dashboard__intro">Choose a management area. Each tool now has its own focused workspace.</p> : null}
      <LeagueAdminNav basePath="/admin/cup" leagueName="Cup Series" tools={cupAdminTools} activeTool={tool} />
      {tool === 'sporting-code' ? <SportingCodeAdmin league="cup" /> : null}
    </div>
  </section>
}
