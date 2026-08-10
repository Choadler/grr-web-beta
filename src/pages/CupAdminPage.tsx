import { Link } from 'react-router-dom'
import { SportingCodeAdmin } from '../components/admin/SportingCodeAdmin'

export function CupAdminPage() {
  return <section className="admin-dashboard">
    <div className="container">
      <div className="admin-page-heading">
        <div><p className="eyebrow">Grassroots Racing Administration</p><h1>Manage Cup Series</h1></div>
        <Link className="button button--secondary" to="/admin">Dashboard</Link>
      </div>
      <SportingCodeAdmin league="cup" />
    </div>
  </section>
}
