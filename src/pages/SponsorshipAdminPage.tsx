import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteSponsorshipInquiry, loadSponsorshipInquiries, updateSponsorshipInquiry } from '../services/sponsorship'
import type { SponsorshipInquiry, SponsorshipStatus } from '../types/sponsorship'

const statusLabels: Record<SponsorshipStatus, string> = { new: 'New', contacted: 'Contacted', closed: 'Closed', declined: 'Declined' }

export function SponsorshipAdminPage() {
  const [inquiries, setInquiries] = useState<SponsorshipInquiry[]>([])
  const [filter, setFilter] = useState<'all' | SponsorshipStatus>('new')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadSponsorshipInquiries().then((items) => {
      if (!active) return
      setInquiries(items)
      setNotes(Object.fromEntries(items.map((item) => [item.id, item.adminNotes || ''])))
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load sponsorship inquiries.') })
    return () => { active = false }
  }, [])

  const save = async (item: SponsorshipInquiry, status = item.status) => {
    setBusyId(item.id)
    try {
      setInquiries(await updateSponsorshipInquiry(item.id, status, notes[item.id] ?? ''))
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The inquiry update failed.') }
    finally { setBusyId('') }
  }
  const remove = async (item: SponsorshipInquiry) => {
    if (!confirm(`Permanently delete the sponsorship inquiry from ${item.brandName}?`)) return
    setBusyId(item.id)
    try { setInquiries(await deleteSponsorshipInquiry(item.id)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The inquiry could not be deleted.') }
    finally { setBusyId('') }
  }

  const visible = inquiries.filter((item) => filter === 'all' || item.status === filter)
  const newCount = inquiries.filter((item) => item.status === 'new').length
  return (
    <section className="admin-dashboard sponsorship-admin">
      <div className="container">
        <div className="admin-page-heading">
          <div><p className="eyebrow">Business inquiries</p><h1>Sponsorship Inquiries</h1><p>{newCount} new sponsorship request{newCount === 1 ? '' : 's'} awaiting review.</p></div>
          <Link className="button button--secondary" to="/admin">Dashboard</Link>
        </div>
        {error && <p className="admin-notice admin-notice--error" role="alert">{error}</p>}
        <div className="sponsorship-admin__filters" role="group" aria-label="Inquiry status">
          {(['new', 'contacted', 'closed', 'declined', 'all'] as const).map((status) => <button className={filter === status ? 'filter-button is-active' : 'filter-button'} type="button" key={status} onClick={() => setFilter(status)}>{status === 'all' ? 'All' : statusLabels[status]}</button>)}
        </div>
        {visible.length ? <div className="sponsorship-admin__list">{visible.map((item) => (
          <article className="sponsorship-inquiry" key={item.id}>
            <header><div><span className={`sponsorship-status sponsorship-status--${item.status}`}>{statusLabels[item.status]}</span><h2>{item.brandName}</h2><p>{item.league} · {item.raceName}</p></div><strong>{item.bid}</strong></header>
            <div className="sponsorship-inquiry__grid">
              <section><h3>Contact</h3><p><strong>{item.contactName}</strong><br /><a href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a></p>{item.brandWebsite && <a href={item.brandWebsite} target="_blank" rel="noreferrer">Visit brand website ↗</a>}</section>
              <section><h3>Submitted</h3><p>{new Date(item.submittedAt).toLocaleString()}</p>{item.reviewedBy && <small>Last reviewed by {item.reviewedBy}</small>}</section>
              <section className="sponsorship-inquiry__details"><h3>Brand &amp; sponsorship details</h3><p>{item.brandInfo}</p></section>
              <section className="sponsorship-inquiry__logos"><h3>Logos</h3><div>{item.logos.map((logo) => <a href={logo.url} target="_blank" rel="noreferrer" key={logo.id}><img src={logo.url} alt={`${item.brandName} logo`} /><span>{logo.fileName}</span></a>)}</div></section>
            </div>
            <label className="sponsorship-inquiry__notes">Internal notes<textarea rows={4} maxLength={4000} value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
            <div className="sponsorship-inquiry__actions">
              <a className="button button--compact" href={`mailto:${item.contactEmail}?subject=${encodeURIComponent(`GRR race sponsorship — ${item.raceName}`)}`}>Email Sponsor</a>
              <label>Status<select value={item.status} disabled={busyId === item.id} onChange={(event) => void save(item, event.target.value as SponsorshipStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <button className="button button--compact button--secondary" type="button" disabled={busyId === item.id} onClick={() => void save(item)}>{busyId === item.id ? 'Saving...' : 'Save Notes'}</button>
              <button className="button button--compact sponsorship-inquiry__delete" type="button" disabled={Boolean(busyId)} onClick={() => void remove(item)}>Delete</button>
            </div>
          </article>
        ))}</div> : <p className="gallery-empty">No {filter === 'all' ? '' : `${filter} `}sponsorship inquiries.</p>}
      </div>
    </section>
  )
}
