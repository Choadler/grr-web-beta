import { adminFetch } from './adminSession'
import type { SponsorshipInquiry, SponsorshipStatus } from '../types/sponsorship'

async function payload(response: Response) {
  const value = (await response.json().catch(() => ({}))) as { inquiries?: SponsorshipInquiry[]; error?: string }
  if (!response.ok) throw new Error(value.error || 'The sponsorship request failed.')
  return value.inquiries ?? []
}

export async function loadSponsorshipInquiries() {
  return payload(await adminFetch('/admin/api/sponsorships', { credentials: 'include', headers: { Accept: 'application/json' } }))
}

export async function updateSponsorshipInquiry(id: string, status: SponsorshipStatus, adminNotes: string) {
  return payload(await adminFetch('/admin/api/sponsorships', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', id, status, adminNotes }),
  }))
}

export async function deleteSponsorshipInquiry(id: string) {
  return payload(await adminFetch('/admin/api/sponsorships', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  }))
}
