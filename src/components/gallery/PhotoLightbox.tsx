import { useEffect } from 'react'
import type { GalleryPhoto } from '../../types/gallery'

export function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: GalleryPhoto | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!photo) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.classList.add('has-lightbox')
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('has-lightbox')
    }
  }, [photo, onClose])

  if (!photo) return null
  return (
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo by ${photo.photographer}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <figure>
        <button
          className="photo-lightbox__close"
          type="button"
          onClick={onClose}
          autoFocus
          aria-label="Close enlarged photo"
        >
          ×
        </button>
        <img src={photo.imageUrl} alt={`Race photo by ${photo.photographer}`} />
        <figcaption>Photo by {photo.photographer}</figcaption>
      </figure>
    </div>
  )
}
