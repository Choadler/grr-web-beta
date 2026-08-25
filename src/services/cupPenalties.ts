import type { CupPenaltyAdminPayload, CupPenaltyReport } from '../types/cupPenalties'

async function responseJson<T>(request: Response | Promise<Response>): Promise<T> {
  const response = await request
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Cup penalty data is unavailable.')
  return payload
}

export const loadCupPenaltyReport = (seasonId: string, signal?: AbortSignal) => responseJson<CupPenaltyReport>(
  fetch(`/api/cup-penalties${seasonId ? `?season=${encodeURIComponent(seasonId)}` : ''}`, { signal, headers: { Accept: 'application/json' } }),
)

export const loadCupPenaltyAdmin = (seasonId: string, signal?: AbortSignal) => responseJson<CupPenaltyAdminPayload>(
  fetch(`/admin/api/cup-penalties${seasonId ? `?season=${encodeURIComponent(seasonId)}` : ''}`, { signal, headers: { Accept: 'application/json' } }),
)

export async function updateCupPenalties(body: Record<string, unknown>): Promise<CupPenaltyReport> {
  const payload = await responseJson<{ report: CupPenaltyReport }>(fetch('/admin/api/cup-penalties', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))
  return payload.report
}
