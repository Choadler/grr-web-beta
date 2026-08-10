import { useEffect } from 'react'
import type { GalleryPhoto } from '../../types/gallery'

export function PhotoLightbox({
  photo,
  onClose,
  onPrevious,
  onNext,
}: {
  photo: GalleryPhoto | null
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
}) {
  useEffect(() => {
    if (!photo) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onPrevious?.()
      if (event.key === 'ArrowRight') onNext?.()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.classList.add('has-lightbox')
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('has-lightbox')
    }
  }, [photo, onClose, onNext, onPrevious])

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
        {onPrevious && (
          <button
            className="photo-lightbox__arrow photo-lightbox__arrow--previous"
            type="button"
            onClick={onPrevious}
            aria-label="View previous photo"
          >
            <span aria-hidden="true">&#8249;</span>
          </button>
        )}
        <img src={photo.imageUrl} alt={`Race photo by ${photo.photographer}`} />
        {onNext && (
          <button
            className="photo-lightbox__arrow photo-lightbox__arrow--next"
            type="button"
            onClick={onNext}
            aria-label="View next photo"
          >
            <span aria-hidden="true">&#8250;</span>
          </button>
        )}
        <figcaption>Photo by {photo.photographer}</figcaption>
      </figure>
    </div>
  )
}
