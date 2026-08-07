import type { GalleryPhoto } from '../types/gallery'

const shuffle = <T,>(items: T[]) => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export const galleryAuthorKey = (photo: GalleryPhoto) =>
  photo.photographer.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

export function authorBalancedGalleryOrder(
  photos: GalleryPhoto[],
  avoidAuthors: ReadonlySet<string> = new Set(),
) {
  const buckets = new Map<string, GalleryPhoto[]>()
  photos.forEach((photo) => {
    const key = galleryAuthorKey(photo)
    buckets.set(key, [...(buckets.get(key) ?? []), photo])
  })

  const preferred = shuffle([...buckets.entries()].filter(([key]) => !avoidAuthors.has(key)))
  const repeated = shuffle([...buckets.entries()].filter(([key]) => avoidAuthors.has(key)))
  const orderedBuckets = [...preferred, ...repeated].map(([author, items]) => ({
    author,
    items: shuffle(items),
  }))
  const ordered: GalleryPhoto[] = []

  // Take one photo from every contributor before using a second from anyone.
  while (orderedBuckets.some((bucket) => bucket.items.length)) {
    orderedBuckets.forEach((bucket) => {
      const photo = bucket.items.shift()
      if (photo) ordered.push(photo)
    })
  }

  return ordered
}

export function selectAuthorBalancedPhotos(
  photos: GalleryPhoto[],
  limit: number,
  avoidAuthors: ReadonlySet<string> = new Set(),
) {
  return authorBalancedGalleryOrder(photos, avoidAuthors).slice(0, limit)
}
