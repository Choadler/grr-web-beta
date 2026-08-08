import { useEffect, useRef, useState } from 'react'
import { loadGallery, submitGalleryPhoto } from '../services/gallery'
import type { GalleryLeague, GalleryPhoto } from '../types/gallery'
import { PageMeta } from '../components/league/PageMeta'
import { PhotoLightbox } from '../components/gallery/PhotoLightbox'
import { prepareGalleryPhoto } from '../utils/galleryImage'

const labels: Record<GalleryLeague, string> = {
  cup: 'Cup Series',
  gt: 'GT League',
  indycar: 'IndyCar',
}

type UploadItem = {
  id: string
  file: File
  previewUrl: string
  status: 'ready' | 'uploading' | 'submitted' | 'error'
  message?: string
}

export function GalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [filter, setFilter] = useState<'all' | GalleryLeague>('all')
  const [photographer, setPhotographer] = useState('')
  const [league, setLeague] = useState<GalleryLeague>('cup')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const uploadsRef = useRef<UploadItem[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<GalleryPhoto | null>(null)

  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])

  useEffect(
    () => () => uploadsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)),
    [],
  )

  useEffect(() => {
    let active = true
    loadGallery(filter === 'all' ? undefined : filter)
      .then((items) => {
        if (!active) return
        setPhotos(items)
        setError('')
      })
      .catch(() => {
        if (!active) return
        setPhotos([])
        setError('The gallery is temporarily unavailable.')
      })
    return () => {
      active = false
    }
  }, [filter])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const waiting = uploads.filter((item) => item.status === 'ready' || item.status === 'error')
    if (!waiting.length) return
    setBusy(true)
    setStatus('')
    setError('')
    let submitted = 0
    const batchId = crypto.randomUUID()
    for (const [batchIndex, item] of waiting.entries()) {
      setUploads((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'uploading', message: '' } : entry,
        ),
      )
      try {
        const prepared = await prepareGalleryPhoto(item.file)
        await submitGalleryPhoto({
          photographer: photographer.trim(),
          league,
          photo: prepared.original,
          displayPhoto: prepared.display,
          thumbnail: prepared.thumbnail,
          batchId,
          batchIndex,
          batchSize: waiting.length,
        })
        submitted += 1
        setUploads((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'submitted', message: 'Waiting for admin approval' }
              : entry,
          ),
        )
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Upload failed.'
        setUploads((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, status: 'error', message } : entry,
          ),
        )
      }
    }
    if (submitted) {
      setStatus(
        `${submitted} photo${submitted === 1 ? '' : 's'} submitted and waiting for administrator approval.`,
      )
    }
    setBusy(false)
  }

  const selectPhotos = (files: FileList | null) => {
    if (!files) return
    const available = Math.max(0, 10 - uploads.length)
    const selected = Array.from(files)
      .slice(0, available)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'ready' as const,
      }))
    setUploads((current) => [...current, ...selected])
  }

  const removeUpload = (id: string) => {
    setUploads((current) => {
      const removed = current.find((item) => item.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  return (
    <section className="gallery-page">
      <PageMeta title="Gallery" description="Grassroots Racing community race photos" />
      <header className="gallery-hero">
        <div className="container">
          <p className="eyebrow">Grassroots Racing Community</p>
          <h1>Gallery</h1>
          <p>Race photos submitted by the Grassroots Racing community.</p>
        </div>
      </header>
      <div className="container gallery-layout">
        <aside className="gallery-submit-card">
          <p className="eyebrow">Share a race photo</p>
          <h2>Add Photo</h2>
          <p>Every submission is reviewed by a GRR administrator before it appears publicly.</p>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Your name
              <input
                required
                minLength={2}
                maxLength={80}
                value={photographer}
                onChange={(event) => setPhotographer(event.target.value)}
              />
            </label>
            <label>
              League
              <select
                value={league}
                onChange={(event) => setLeague(event.target.value as GalleryLeague)}
              >
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="gallery-file-picker">
              Add photos
              <input
                id="gallery-photo"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  selectPhotos(event.target.files)
                  event.target.value = ''
                }}
              />
              <span>Choose up to 10 JPEG, PNG, or WebP photos (50 MB each)</span>
            </label>
            {uploads.length > 0 && (
              <div className="gallery-upload-queue" aria-label="Selected photos">
                {uploads.map((item) => (
                  <article
                    key={item.id}
                    className={`gallery-upload-item gallery-upload-item--${item.status}`}
                  >
                    <img src={item.previewUrl} alt="Selected upload preview" />
                    <div>
                      <strong>{item.file.name}</strong>
                      <span>
                        {item.status === 'ready'
                          ? 'Ready to submit'
                          : item.status === 'uploading'
                            ? 'Uploading...'
                            : item.message}
                      </span>
                    </div>
                    {item.status !== 'uploading' && (
                      <button
                        type="button"
                        onClick={() => removeUpload(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                      >
                        ×
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            <label className="gallery-honeypot" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <button
              className="button"
              type="submit"
              disabled={
                busy ||
                !uploads.some((item) => item.status === 'ready' || item.status === 'error') ||
                !photographer.trim()
              }
            >
              {busy
                ? 'Submitting photos...'
                : `Submit ${uploads.filter((item) => item.status === 'ready' || item.status === 'error').length || ''} for approval`}
            </button>
          </form>
          {status && (
            <p className="gallery-notice gallery-notice--success" role="status">
              {status}
            </p>
          )}
          {error && (
            <p className="gallery-notice gallery-notice--error" role="alert">
              {error}
            </p>
          )}
        </aside>
        <div className="gallery-collection">
          <div className="gallery-toolbar">
            <h2>Community Photos</h2>
            <label>
              <span className="sr-only">Filter gallery by league</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}
              >
                <option value="all">All leagues</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {photos.length ? (
            <div className="gallery-grid">
              {photos.map((item) => (
                <figure key={item.id}>
                  <button
                    className="gallery-photo-button"
                    type="button"
                    onClick={() => setSelected(item)}
                    aria-label={`Enlarge photo by ${item.photographer}`}
                  >
                    <img
                      src={item.thumbnailUrl || item.imageUrl}
                      alt={`${labels[item.league]} race submitted by ${item.photographer}`}
                      loading="lazy"
                    />
                  </button>
                  <figcaption>
                    <strong>{labels[item.league]}</strong>
                    <span>Photo by {item.photographer}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : !error ? (
            <p className="gallery-empty">No approved photos have been added yet.</p>
          ) : null}
        </div>
      </div>
      <PhotoLightbox photo={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
