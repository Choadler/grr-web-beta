export type SponsorshipStatus = 'new' | 'contacted' | 'closed' | 'declined'

export type SponsorshipInquiry = {
  id: string
  contactName: string
  contactEmail: string
  brandName: string
  brandWebsite?: string
  league: string
  raceName: string
  bid: string
  brandInfo: string
  status: SponsorshipStatus
  adminNotes: string
  submittedAt: string
  reviewedAt?: string
  reviewedBy?: string
  logos: { id: string; fileName: string; url: string }[]
}
