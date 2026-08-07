export type GalleryLeague = 'cup' | 'gt' | 'indycar'
export type GalleryStatus = 'pending' | 'approved' | 'rejected'

export type GalleryPhoto = {
  id: string
  photographer: string
  league: GalleryLeague
  imageUrl: string
  thumbnailUrl?: string
  submittedAt: string
  status?: GalleryStatus
  reviewedAt?: string | null
  reviewedBy?: string | null
  contentType?: string
  fileSize?: number
  showcaseEnabled?: boolean
}
