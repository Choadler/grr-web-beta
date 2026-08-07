import { useEffect, useState } from 'react'
import { PhotoLightbox } from '../gallery/PhotoLightbox'
import { loadGallery } from '../../services/gallery'
import type { GalleryLeague, GalleryPhoto } from '../../types/gallery'
import { authorBalancedGalleryOrder } from '../../utils/gallerySelection'

export function LeaguePhotoRails({ league }: { league: GalleryLeague }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [selected, setSelected] = useState<GalleryPhoto | null>(null)
  const [perSide, setPerSide] = useState(3)

  useEffect(() => {
    const controller = new AbortController()
    loadGallery(league, 30, true)
      .then((items) => {
        if (!controller.signal.aborted) setPhotos(authorBalancedGalleryOrder(items))
      })
      .catch(() => {
        if (!controller.signal.aborted) setPhotos([])
      })
    return () => controller.abort()
  }, [league])

  useEffect(() => {
    const updateCapacity = () => {
      const contentWidth = 1180
      const gutterWidth = Math.max(0, (window.innerWidth - contentWidth) / 2 - 32)
      const railWidth = Math.min(300, gutterWidth, Math.max(150, (window.innerHeight - 384) * 0.53))
      const tileHeight = railWidth * (10 / 16)
      const availableHeight = Math.max(tileHeight, window.innerHeight - 348)
      setPerSide(Math.max(1, Math.floor((availableHeight + 12) / (tileHeight + 12))))
    }
    updateCapacity()
    window.addEventListener('resize', updateCapacity)
    return () => window.removeEventListener('resize', updateCapacity)
  }, [])

  const visible = photos.slice(0, perSide * 2)

  if (!visible.length) return null
  const leftCount = Math.ceil(visible.length / 2)
  const left = visible.slice(0, leftCount)
  const right = visible.slice(leftCount)
  return (
    <div className="league-photo-rails" aria-label="Community race photos">
      {(
        [
          ['left', left],
          ['right', right],
        ] as const
      ).map(([side, sidePhotos]) =>
        sidePhotos.length ? (
          <div className={`league-photo-stack league-photo-stack--${side}`} key={side}>
            {sidePhotos.map((photo) => (
              <figure className="league-photo-rail" key={photo.id}>
                <button
                  className="league-photo-button"
                  type="button"
                  onClick={() => setSelected(photo)}
                  aria-label={`Enlarge photo by ${photo.photographer}`}
                >
                  <img
                    src={photo.thumbnailUrl || photo.imageUrl}
                    alt={`${league} race submitted by ${photo.photographer}`}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <figcaption>Photo by {photo.photographer}</figcaption>
              </figure>
            ))}
          </div>
        ) : null,
      )}
      <PhotoLightbox photo={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
