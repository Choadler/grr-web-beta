import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadGallery } from '../../services/gallery'
import type { GalleryLeague, GalleryPhoto } from '../../types/gallery'
import { PhotoLightbox } from './PhotoLightbox'

const leagues: GalleryLeague[] = ['cup', 'gt', 'indycar']
const labels: Record<GalleryLeague, string> = {
  cup: 'Cup Series',
  gt: 'GT League',
  indycar: 'IndyCar',
}

const randomTwo = (photos: GalleryPhoto[]) =>
  [...photos].sort(() => Math.random() - 0.5).slice(0, 2)

export function HomeGallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [selected, setSelected] = useState<GalleryPhoto | null>(null)

  useEffect(() => {
    let active = true
    Promise.all(leagues.map((league) => loadGallery(league, 30, true)))
      .then((groups) => {
        if (!active) return
        const balanced = groups.flatMap(randomTwo)
        setPhotos(balanced)
      })
      .catch(() => {
        if (active) setPhotos([])
      })
    return () => {
      active = false
    }
  }, [])

  if (!photos.length) return null

  return (
    <section className="home-gallery-section section" aria-labelledby="home-gallery-title">
      <div className="container">
        <div className="home-gallery-heading">
          <div>
            <p className="eyebrow">Community race photos</p>
            <h2 id="home-gallery-title">From the Gallery</h2>
          </div>
          <Link className="button button--outline" to="/gallery">
            View Gallery
          </Link>
        </div>
        <div className="home-gallery-grid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <button
                className="gallery-photo-button"
                type="button"
                onClick={() => setSelected(photo)}
                aria-label={`Enlarge photo by ${photo.photographer}`}
              >
                <img
                  src={photo.imageUrl}
                  alt={`${labels[photo.league]} race submitted by ${photo.photographer}`}
                  loading="lazy"
                />
              </button>
              <figcaption>
                <strong>{labels[photo.league]}</strong>
                <span>Photo by {photo.photographer}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <PhotoLightbox photo={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
