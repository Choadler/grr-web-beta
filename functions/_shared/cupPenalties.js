export const penaltyTypes = new Set(['AT_FAULT_INCIDENT', 'CLEAN_RACE', 'ADMIN_ADJUSTMENT', 'APPEAL_ADJUSTMENT', 'SUSPENSION_REDUCTION', 'OTHER'])
export const penaltyStatuses = new Set(['ACTIVE', 'UNDER_APPEAL', 'OVERTURNED'])
export const sanctionStatuses = new Set(['PENDING', 'SERVED', 'WAIVED'])
export const activePenaltyBalance = (entries) => Math.max(0, entries.reduce((sum, entry) => sum + (entry.status === 'OVERTURNED' ? 0 : Number(entry.adjustment) || 0), 0))
export const crossedThreshold = (before, after, threshold) => before < threshold && after >= threshold

export const penaltyBalance = async (db, seasonId, driverId) => {
  const row = await db.prepare(`SELECT MAX(0,COALESCE(SUM(adjustment),0)) AS balance FROM cup_penalties
    WHERE season_id=? AND srh_driver_id=? AND status<>'OVERTURNED'`).bind(seasonId, driverId).first()
  return Number(row?.balance ?? 0)
}

export async function reconcileSanctions(db, { seasonId, driverId, driverName, triggerPenaltyId, before, after }) {
  const statements = []
  for (const [type, threshold] of [['QUALIFYING_BAN', 9], ['RACE_SUSPENSION', 12]]) {
    if (crossedThreshold(before, after, threshold)) {
      statements.push(db.prepare(`INSERT OR IGNORE INTO cup_sanctions
        (id,season_id,srh_driver_id,driver_name_snapshot,sanction_type,triggering_balance,trigger_penalty_id)
        VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), seasonId, driverId, driverName, type, after, triggerPenaltyId || null))
    }
    if (after < threshold) {
      statements.push(db.prepare(`UPDATE cup_sanctions SET status='WAIVED',waived_at=CURRENT_TIMESTAMP,
        admin_notes=CASE WHEN TRIM(COALESCE(admin_notes,''))='' THEN 'Threshold no longer met after penalty ledger recalculation.' ELSE admin_notes END,
        updated_at=CURRENT_TIMESTAMP WHERE season_id=? AND srh_driver_id=? AND sanction_type=? AND status='PENDING'`)
        .bind(seasonId, driverId, type))
    }
  }
  if (statements.length) await db.batch(statements)
}

export async function selectedCupSeason(db, requested, includeDraft = false) {
  const status = includeDraft ? '' : " AND status<>'draft'"
  return requested
    ? db.prepare(`SELECT id,name,status,srh_season_id AS srhSeasonId FROM cup_seasons WHERE id=?${status}`).bind(requested).first()
    : db.prepare("SELECT id,name,status,srh_season_id AS srhSeasonId FROM cup_seasons WHERE status='active' LIMIT 1").first()
}

export async function cupPenaltyReport(db, season, admin = false) {
  const [penaltiesResult, sanctionsResult, driversResult, eventsResult] = await Promise.all([
    db.prepare(`SELECT p.id,p.season_id AS seasonId,p.srh_driver_id AS driverId,p.driver_name_snapshot AS driver,
      p.event_id AS eventId,p.event_name_snapshot AS eventName,p.event_round_snapshot AS eventRound,p.event_date_snapshot AS eventDate,
      p.adjustment,p.penalty_type AS type,p.description,p.status,p.appeal_note AS appealNote,p.admin_note AS adminNote,
      p.system_generated AS systemGenerated,p.related_sanction_id AS relatedSanctionId,p.created_by AS createdBy,
      p.created_at AS createdAt,p.updated_at AS updatedAt
      FROM cup_penalties p WHERE p.season_id=? ORDER BY p.created_at,p.id`).bind(season.id).all(),
    db.prepare(`SELECT s.id,s.season_id AS seasonId,s.srh_driver_id AS driverId,s.driver_name_snapshot AS driver,
      s.sanction_type AS type,s.triggering_balance AS triggeringBalance,s.trigger_penalty_id AS triggerPenaltyId,
      s.target_event_id AS targetEventId,s.target_event_name_snapshot AS targetEventName,s.status,s.served_at AS servedAt,
      s.waived_at AS waivedAt,s.admin_notes AS adminNotes,s.related_adjustment_id AS relatedAdjustmentId,
      s.created_at AS createdAt,s.updated_at AS updatedAt FROM cup_sanctions s WHERE s.season_id=? ORDER BY s.created_at,s.id`).bind(season.id).all(),
    admin ? db.prepare(`SELECT DISTINCT d.srh_driver_id AS id,d.display_name AS name FROM cup_drivers d
      LEFT JOIN cup_standings st ON st.srh_driver_id=d.srh_driver_id AND st.season_id=?
      LEFT JOIN cup_results r ON r.srh_driver_id=d.srh_driver_id AND r.season_id=?
      WHERE st.srh_driver_id IS NOT NULL OR r.srh_driver_id IS NOT NULL ORDER BY d.display_name`).bind(season.id, season.id).all() : Promise.resolve({ results: [] }),
    admin ? db.prepare(`SELECT id,srh_schedule_id AS srhScheduleId,round_number AS round,race_date AS date,track,event_name AS eventName
      FROM cup_events WHERE season_id=? AND TRIM(COALESCE(track,''))<>'' ORDER BY round_number`).bind(season.id).all() : Promise.resolve({ results: [] }),
  ])
  const penalties = penaltiesResult.results
  const sanctions = sanctionsResult.results
  if (!admin) {
    for (const penalty of penalties) {
      delete penalty.adminNote
      delete penalty.createdBy
    }
    for (const sanction of sanctions) delete sanction.adminNotes
  }
  const rawBalances = new Map()
  for (const penalty of penalties) {
    if (penalty.status !== 'OVERTURNED') rawBalances.set(penalty.driverId, (rawBalances.get(penalty.driverId) ?? 0) + penalty.adjustment)
    penalty.runningTotal = Math.max(0, rawBalances.get(penalty.driverId) ?? 0)
  }
  const summaries = [...new Set(penalties.map((item) => item.driverId))].map((driverId) => {
    const history = penalties.filter((item) => item.driverId === driverId)
    const balance = Math.max(0, rawBalances.get(driverId) ?? 0)
    return { driverId, driver: history.at(-1)?.driver ?? '', balance,
      level: balance >= 12 ? 'SUSPENSION_THRESHOLD' : balance >= 9 ? 'QUALIFYING_BAN_THRESHOLD' : balance > 0 ? 'ACTIVE' : 'CLEAR',
      pendingSanctions: sanctions.filter((item) => item.driverId === driverId && item.status === 'PENDING'),
      lastPenalty: history.at(-1) ?? null }
  }).sort((a, b) => b.balance - a.balance || a.driver.localeCompare(b.driver))
  return { season, summaries, penalties: [...penalties].reverse(), sanctions: [...sanctions].reverse(), drivers: driversResult.results, events: eventsResult.results }
}
