import type { GalleryLeague, GalleryPhoto, GalleryStatus } from '../types/gallery'
import { adminFetch } from './adminSession'

type GalleryResponse = { photos?: GalleryPhoto[]; error?: string; message?: string }

const devPhotos: GalleryPhoto[] = []

async function payload(response: Response) {
  const body = (await response.json().catch(() => ({}))) as GalleryResponse
  if (!response.ok) throw new Error(body.error || `Gallery request failed (${response.status}).`)
  return body
}

export async function loadGallery(league?: GalleryLeague, limit = 60, showcaseOnly = false) {
  if (import.meta.env.DEV) {
    return devPhotos
      .filter(
        (photo) =>
          photo.status === 'approved' &&
          (!league || photo.league === league) &&
          (!showcaseOnly || photo.showcaseEnabled !== false),
      )
      .slice(0, limit)
  }
  const query = new URLSearchParams({ limit: String(limit) })
  if (league) query.set('league', league)
  if (showcaseOnly) query.set('showcase', '1')
  const response = await fetch(`/api/gallery?${query}`, { headers: { Accept: 'application/json' } })
  return (await payload(response)).photos ?? []
}

export async function submitGalleryPhoto(input: {
  photographer: string
  league: GalleryLeague
  photo: File
  displayPhoto?: File
  thumbnail?: File
  batchId?: string
  batchIndex?: number
  batchSize?: number
}) {
  if (import.meta.env.DEV) {
    devPhotos.unshift({
      id: crypto.randomUUID(),
      photographer: input.photographer,
      league: input.league,
      imageUrl: URL.createObjectURL(input.photo),
      submittedAt: new Date().toISOString(),
      status: 'pending',
      contentType: input.photo.type,
      fileSize: input.photo.size,
    })
    return 'Photo submitted for administrator approval.'
  }
  const form = new FormData()
  form.set('photographer', input.photographer)
  form.set('league', input.league)
  form.set('photo', input.photo)
  if (input.displayPhoto) form.set('displayPhoto', input.displayPhoto)
  if (input.thumbnail) form.set('thumbnail', input.thumbnail)
  if (input.batchId) form.set('batchId', input.batchId)
  if (input.batchIndex !== undefined) form.set('batchIndex', String(input.batchIndex))
  if (input.batchSize !== undefined) form.set('batchSize', String(input.batchSize))
  form.set('website', '')
  const response = await fetch('/api/gallery', { method: 'POST', body: form })
  return (await payload(response)).message ?? 'Photo submitted for administrator approval.'
}

export async function loadGalleryAdmin() {
  if (import.meta.env.DEV) return [...devPhotos]
  const response = await adminFetch('/admin/api/gallery', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  return (await payload(response)).photos ?? []
}

export async function moderateGalleryPhoto(
  id: string,
  action: 'approve' | 'reject' | 'delete' | 'update',
  updates?: { photographer?: string; league?: GalleryLeague; showcaseEnabled?: boolean },
) {
  if (import.meta.env.DEV) {
    const index = devPhotos.findIndex((photo) => photo.id === id)
    if (index < 0) return [...devPhotos]
    if (action === 'delete') devPhotos.splice(index, 1)
    else if (action === 'update') {
      devPhotos[index] = { ...devPhotos[index], ...updates }
    } else {
      devPhotos[index] = {
        ...devPhotos[index],
        status: action === 'approve' ? 'approved' : ('rejected' as GalleryStatus),
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'Local administrator',
      }
    }
    return [...devPhotos]
  }
  const response = await adminFetch('/admin/api/gallery', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, ...updates }),
  })
  return (await payload(response)).photos ?? []
}
