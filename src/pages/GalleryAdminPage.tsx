import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadGalleryAdmin, moderateGalleryPhoto } from '../services/gallery'
import type { GalleryLeague, GalleryPhoto, GalleryStatus } from '../types/gallery'
import { PhotoLightbox } from '../components/gallery/PhotoLightbox'

const labels = { cup: 'Cup Series', gt: 'GT League', indycar: 'IndyCar' }

export function GalleryAdminPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [filter, setFilter] = useState<'all' | GalleryStatus>('pending')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [selected, setSelected] = useState<GalleryPhoto | null>(null)
  const [authorDrafts, setAuthorDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    loadGalleryAdmin()
      .then((items) => {
        if (!active) return
        setPhotos(items)
        setAuthorDrafts(Object.fromEntries(items.map((photo) => [photo.id, photo.photographer])))
        setError('')
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Could not load gallery moderation.')
      })
    return () => {
      active = false
    }
  }, [])

  const moderate = async (photo: GalleryPhoto, action: 'approve' | 'reject' | 'delete') => {
    if (action === 'delete' && !confirm('Permanently delete this submitted photo?')) return
    setBusyId(photo.id)
    try {
      setPhotos(await moderateGalleryPhoto(photo.id, action))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The gallery update failed.')
    } finally {
      setBusyId('')
    }
  }

  const updateDetails = async (
    photo: GalleryPhoto,
    updates: { photographer?: string; league?: GalleryLeague; showcaseEnabled?: boolean },
  ) => {
    setBusyId(photo.id)
    try {
      const photographer = (
        updates.photographer ??
        authorDrafts[photo.id] ??
        photo.photographer
      ).trim()
      const updated = await moderateGalleryPhoto(photo.id, 'update', {
        photographer,
        league: updates.league ?? photo.league,
        showcaseEnabled: updates.showcaseEnabled ?? photo.showcaseEnabled !== false,
      })
      setPhotos(updated)
      setAuthorDrafts((current) => ({ ...current, [photo.id]: photographer }))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The gallery update failed.')
    } finally {
      setBusyId('')
    }
  }

  const approveGalleryOnly = async (photo: GalleryPhoto) => {
    setBusyId(photo.id)
    try {
      const photographer = (authorDrafts[photo.id] ?? photo.photographer).trim()
      await moderateGalleryPhoto(photo.id, 'update', {
        photographer,
        league: photo.league,
        showcaseEnabled: false,
      })
      setPhotos(await moderateGalleryPhoto(photo.id, 'approve'))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The gallery update failed.')
    } finally {
      setBusyId('')
    }
  }

  const approveAll = async () => {
    const waiting = photos.filter((photo) => photo.status === 'pending')
    if (!waiting.length || !confirm(`Approve all ${waiting.length} pending photos?`)) return
    setBusyId('all')
    try {
      let updated = photos
      for (const photo of waiting) updated = await moderateGalleryPhoto(photo.id, 'approve')
      setPhotos(updated)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Bulk approval failed.')
    } finally {
      setBusyId('')
    }
  }

  const visible = photos.filter((photo) => filter === 'all' || photo.status === filter)
  const pending = photos.filter((photo) => photo.status === 'pending').length
  return (
    <section className="admin-dashboard gallery-admin">
      <div className="container">
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">Community photos</p>
            <h1>Manage Gallery</h1>
            <p>
              {pending} photo{pending === 1 ? '' : 's'} awaiting review.
            </p>
          </div>
          <Link className="button button--secondary" to="/admin">
            Dashboard
          </Link>
        </div>
        {error && (
          <p className="admin-notice admin-notice--error" role="alert">
            {error}
          </p>
        )}
        <div className="gallery-admin__filters" role="group" aria-label="Moderation status">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((value) => (
            <button
              className={filter === value ? 'filter-button is-active' : 'filter-button'}
              type="button"
              key={value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
          <button
            className="button button--compact gallery-approve-all"
            type="button"
            disabled={!pending || Boolean(busyId)}
            onClick={() => void approveAll()}
          >
            {busyId === 'all' ? 'Approving...' : `Approve all (${pending})`}
          </button>
        </div>
        {visible.length ? (
          <div className="gallery-admin-grid">
            {visible.map((photo) => (
              <article className="gallery-admin-card" key={photo.id}>
                <button
                  className="gallery-photo-button"
                  type="button"
                  onClick={() => setSelected(photo)}
                  aria-label={`Enlarge submission by ${photo.photographer}`}
                >
                  <img
                    src={photo.thumbnailUrl || photo.imageUrl}
                    alt={`Submission by ${photo.photographer}`}
                    loading="lazy"
                  />
                </button>
                <div>
                  <span className={`gallery-status gallery-status--${photo.status}`}>
                    {photo.status}
                  </span>
                  <label className="gallery-admin-author">
                    Author
                    <span>
                      <input
                        value={authorDrafts[photo.id] ?? photo.photographer}
                        minLength={2}
                        maxLength={80}
                        onChange={(event) =>
                          setAuthorDrafts((current) => ({
                            ...current,
                            [photo.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="button button--compact button--secondary"
                        type="button"
                        disabled={
                          Boolean(busyId) ||
                          (authorDrafts[photo.id] ?? photo.photographer).trim() ===
                            photo.photographer
                        }
                        onClick={() => void updateDetails(photo, {})}
                      >
                        Save
                      </button>
                    </span>
                  </label>
                  <p>
                    {labels[photo.league]} · {new Date(photo.submittedAt).toLocaleString()}
                  </p>
                  {photo.reviewedBy && <small>Reviewed by {photo.reviewedBy}</small>}
                  <label className="gallery-display-league">
                    Display under
                    <select
                      value={photo.league}
                      disabled={Boolean(busyId)}
                      onChange={(event) =>
                        void updateDetails(photo, {
                          league: event.target.value as GalleryLeague,
                        })
                      }
                    >
                      {Object.entries(labels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="gallery-showcase-toggle">
                    <input
                      type="checkbox"
                      checked={photo.showcaseEnabled !== false}
                      disabled={Boolean(busyId)}
                      onChange={(event) =>
                        void updateDetails(photo, { showcaseEnabled: event.target.checked })
                      }
                    />
                    <span>
                      Feature on homepage and league pages
                      <small>Turn off to keep it in the Gallery only.</small>
                    </span>
                  </label>
                  <div className="gallery-admin-card__actions">
                    {photo.status !== 'approved' && (
                      <button
                        className="button button--compact"
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => void moderate(photo, 'approve')}
                      >
                        Approve
                      </button>
                    )}
                    {photo.status !== 'approved' && (
                      <button
                        className="button button--compact button--secondary"
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => void approveGalleryOnly(photo)}
                      >
                        Approve Gallery Only
                      </button>
                    )}
                    {photo.status !== 'rejected' && (
                      <button
                        className="button button--compact button--secondary"
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => void moderate(photo, 'reject')}
                      >
                        Reject
                      </button>
                    )}
                    <button
                      className="button button--compact gallery-delete"
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void moderate(photo, 'delete')}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="gallery-empty">No {filter === 'all' ? '' : `${filter} `}photos.</p>
        )}
      </div>
      <PhotoLightbox photo={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
