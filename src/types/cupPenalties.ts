export type CupPenaltyStatus = 'ACTIVE' | 'UNDER_APPEAL' | 'OVERTURNED'
export type CupPenaltyType = 'AT_FAULT_INCIDENT' | 'CLEAN_RACE' | 'ADMIN_ADJUSTMENT' | 'APPEAL_ADJUSTMENT' | 'SUSPENSION_REDUCTION' | 'OTHER'
export type CupSanctionStatus = 'PENDING' | 'SERVED' | 'WAIVED'
export type CupSanctionType = 'QUALIFYING_BAN' | 'RACE_SUSPENSION'

export type CupPenalty = {
  id: string; seasonId: string; driverId: number; driver: string; eventId?: string; eventName: string; eventRound?: number; eventDate?: string
  adjustment: number; type: CupPenaltyType; description: string; status: CupPenaltyStatus; appealNote?: string; adminNote?: string
  systemGenerated: number; relatedSanctionId?: string; createdBy?: string; createdAt: string; updatedAt: string; runningTotal: number
}
export type CupSanction = {
  id: string; seasonId: string; driverId: number; driver: string; type: CupSanctionType; triggeringBalance: number; triggerPenaltyId?: string
  targetEventId?: string; targetEventName?: string; status: CupSanctionStatus; servedAt?: string; waivedAt?: string; adminNotes?: string
  relatedAdjustmentId?: string; createdAt: string; updatedAt: string
}
export type CupPenaltySummary = { driverId: number; driver: string; balance: number; level: 'CLEAR' | 'ACTIVE' | 'QUALIFYING_BAN_THRESHOLD' | 'SUSPENSION_THRESHOLD'; pendingSanctions: CupSanction[]; lastPenalty: CupPenalty | null }
export type CupPenaltyReport = {
  season: { id: string; name: string; status: string; srhSeasonId: number }
  summaries: CupPenaltySummary[]; penalties: CupPenalty[]; sanctions: CupSanction[]
  drivers: Array<{ id: number; name: string }>
  events: Array<{ id: string; srhScheduleId: number; round: number; date?: string; track: string; eventName?: string }>
}
export type CupPenaltyAdminPayload = { seasons: Array<{ id: string; name: string; status: string; srhSeasonId: number }>; report: CupPenaltyReport | null }
