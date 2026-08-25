import { cupPenaltyReport, penaltyBalance, penaltyStatuses, penaltyTypes, reconcileSanctions, sanctionStatuses, selectedCupSeason } from '../../../_shared/cupPenalties.js'

const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
const text = (value) => typeof value === 'string' ? value.trim() : ''
const integer = (value) => Number.isInteger(Number(value)) ? Number(value) : null

async function seasonPayload(db, seasonId) {
  const season = await selectedCupSeason(db, seasonId, true)
  if (!season) throw new Error('That Cup season was not found.')
  return cupPenaltyReport(db, season, true)
}

async function penaltyContext(db, seasonId, driverId, eventId) {
  const [season, driver, event] = await Promise.all([
    selectedCupSeason(db, seasonId, true),
    db.prepare(`SELECT d.srh_driver_id AS id,d.display_name AS name FROM cup_drivers d WHERE d.srh_driver_id=? AND
      (EXISTS(SELECT 1 FROM cup_standings s WHERE s.season_id=? AND s.srh_driver_id=d.srh_driver_id) OR
       EXISTS(SELECT 1 FROM cup_results r WHERE r.season_id=? AND r.srh_driver_id=d.srh_driver_id))`).bind(driverId, seasonId, seasonId).first(),
    eventId ? db.prepare(`SELECT id,round_number AS round,race_date AS date,track,event_name AS eventName FROM cup_events WHERE id=? AND season_id=?`).bind(eventId, seasonId).first() : null,
  ])
  if (!season) throw new Error('That Cup season was not found.')
  if (!driver) throw new Error('Select a known Cup driver from this season.')
  if (eventId && !event) throw new Error('Select a known Cup event from this season.')
  return { season, driver, event }
}

export async function onRequestGet({ env, request }) {
  if (!env.INDYCAR_DB) return json({ error: 'Cup penalty data is not configured.' }, 503)
  try {
    const url = new URL(request.url)
    const seasons = (await env.INDYCAR_DB.prepare(`SELECT id,name,status,srh_season_id AS srhSeasonId FROM cup_seasons ORDER BY srh_season_id DESC`).all()).results
    const selectedId = url.searchParams.get('season') || seasons.find((item) => item.status === 'active')?.id || seasons[0]?.id
    if (!selectedId) return json({ seasons, report: null })
    return json({ seasons, report: await seasonPayload(env.INDYCAR_DB, selectedId) })
  } catch (error) {
    console.error(JSON.stringify({ message: 'Cup penalty admin read failed.', error: error instanceof Error ? error.message : String(error) }))
    return json({ error: error instanceof Error ? error.message : 'Cup penalty data is unavailable.' }, 400)
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.INDYCAR_DB) return json({ error: 'Cup penalty data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  try {
    const body = await request.json()
    const seasonId = text(body.seasonId)
    if (!seasonId) return json({ error: 'A Cup season is required.' }, 400)
    const actor = request.headers.get('Cf-Access-Authenticated-User-Email') || 'GRR administrator'

    if (body.action === 'createPenalty') {
      const driverId = integer(body.driverId), adjustment = integer(body.adjustment), eventId = text(body.eventId)
      const type = text(body.type), status = text(body.status) || 'ACTIVE', description = text(body.description)
      if (driverId === null || adjustment === null || !penaltyTypes.has(type) || !penaltyStatuses.has(status)) return json({ error: 'Complete all required penalty fields.' }, 400)
      if (!description || (type === 'AT_FAULT_INCIDENT' && adjustment > 0 && !description)) return json({ error: 'A public penalty description is required.' }, 400)
      const { driver, event } = await penaltyContext(db, seasonId, driverId, eventId)
      const before = await penaltyBalance(db, seasonId, driverId)
      const id = crypto.randomUUID()
      const eventName = event ? (text(event.eventName) || text(event.track) || `Round ${event.round}`) : 'Administrative Adjustment'
      await db.prepare(`INSERT INTO cup_penalties(id,season_id,srh_driver_id,driver_name_snapshot,event_id,event_name_snapshot,event_round_snapshot,event_date_snapshot,
        adjustment,penalty_type,description,status,appeal_note,admin_note,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, seasonId, driverId, driver.name, event?.id || null, eventName, event?.round || null, event?.date || null, adjustment, type, description, status, text(body.appealNote) || null, text(body.adminNote) || null, actor).run()
      const after = await penaltyBalance(db, seasonId, driverId)
      await reconcileSanctions(db, { seasonId, driverId, driverName: driver.name, triggerPenaltyId: id, before, after })
      return json({ report: await seasonPayload(db, seasonId) })
    }

    if (body.action === 'updatePenalty') {
      const id = text(body.penaltyId)
      const existing = await db.prepare(`SELECT id,season_id AS seasonId,srh_driver_id AS driverId,driver_name_snapshot AS driver,adjustment,penalty_type AS type,
        description,status,system_generated AS systemGenerated FROM cup_penalties WHERE id=? AND season_id=?`).bind(id, seasonId).first()
      if (!existing) return json({ error: 'That penalty entry was not found.' }, 404)
      if (existing.systemGenerated && (body.adjustment !== undefined || body.type !== undefined)) return json({ error: 'System-generated suspension reductions cannot be edited.' }, 409)
      const before = await penaltyBalance(db, seasonId, existing.driverId)
      const adjustment = body.adjustment === undefined ? existing.adjustment : integer(body.adjustment)
      const type = body.type === undefined ? existing.type : text(body.type)
      const status = body.status === undefined ? existing.status : text(body.status)
      const description = body.description === undefined ? existing.description : text(body.description)
      if (adjustment === null || !penaltyTypes.has(type) || !penaltyStatuses.has(status) || !description) return json({ error: 'The penalty update is invalid.' }, 400)
      await db.prepare(`UPDATE cup_penalties SET adjustment=?,penalty_type=?,description=?,status=?,appeal_note=?,admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND season_id=?`)
        .bind(adjustment, type, description, status, body.appealNote === undefined ? null : text(body.appealNote) || null, body.adminNote === undefined ? null : text(body.adminNote) || null, id, seasonId).run()
      const after = await penaltyBalance(db, seasonId, existing.driverId)
      await reconcileSanctions(db, { seasonId, driverId: existing.driverId, driverName: existing.driver, triggerPenaltyId: id, before, after })
      return json({ report: await seasonPayload(db, seasonId) })
    }

    if (body.action === 'updateSanction') {
      const sanctionId = text(body.sanctionId), status = text(body.status)
      if (!sanctionStatuses.has(status)) return json({ error: 'Select a valid sanction status.' }, 400)
      const sanction = await db.prepare(`SELECT id,season_id AS seasonId,srh_driver_id AS driverId,driver_name_snapshot AS driver,sanction_type AS type,status FROM cup_sanctions WHERE id=? AND season_id=?`).bind(sanctionId, seasonId).first()
      if (!sanction) return json({ error: 'That sanction was not found.' }, 404)
      if (sanction.status !== 'PENDING' && sanction.status !== status) return json({ error: 'A completed sanction cannot be changed.' }, 409)
      const targetEventId = text(body.targetEventId)
      const target = targetEventId ? await db.prepare('SELECT id,track,event_name AS eventName FROM cup_events WHERE id=? AND season_id=?').bind(targetEventId, seasonId).first() : null
      if (targetEventId && !target) return json({ error: 'Select a known Cup event for this sanction.' }, 400)
      const notes = text(body.adminNotes) || null
      if (status === 'SERVED' && sanction.type === 'RACE_SUSPENSION') {
        const before = await penaltyBalance(db, seasonId, sanction.driverId)
        const adjustmentId = crypto.randomUUID()
        await db.batch([
          db.prepare(`INSERT OR IGNORE INTO cup_penalties(id,season_id,srh_driver_id,driver_name_snapshot,event_id,event_name_snapshot,adjustment,penalty_type,description,status,admin_note,created_by,system_generated,related_sanction_id)
            SELECT ?,season_id,srh_driver_id,driver_name_snapshot,?,'Suspension Served',-6,'SUSPENSION_REDUCTION','Automatic penalty-point reduction following completion of one-race suspension.','ACTIVE',?, ?,1,id
            FROM cup_sanctions WHERE id=? AND season_id=? AND status='PENDING'`)
            .bind(adjustmentId, target?.id || null, notes, actor, sanctionId, seasonId),
          db.prepare(`UPDATE cup_sanctions SET status='SERVED',served_at=CURRENT_TIMESTAMP,target_event_id=?,target_event_name_snapshot=?,admin_notes=?,
            related_adjustment_id=(SELECT id FROM cup_penalties WHERE related_sanction_id=cup_sanctions.id AND penalty_type='SUSPENSION_REDUCTION'),updated_at=CURRENT_TIMESTAMP
            WHERE id=? AND season_id=? AND status='PENDING'`).bind(target?.id || null, target ? (text(target.eventName) || text(target.track)) : null, notes, sanctionId, seasonId),
        ])
        const after = await penaltyBalance(db, seasonId, sanction.driverId)
        await reconcileSanctions(db, { seasonId, driverId: sanction.driverId, driverName: sanction.driver, triggerPenaltyId: adjustmentId, before, after })
      } else {
        await db.prepare(`UPDATE cup_sanctions SET status=?,served_at=CASE WHEN ?='SERVED' THEN CURRENT_TIMESTAMP ELSE served_at END,
          waived_at=CASE WHEN ?='WAIVED' THEN CURRENT_TIMESTAMP ELSE waived_at END,target_event_id=?,target_event_name_snapshot=?,admin_notes=?,updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND season_id=? AND status='PENDING'`).bind(status, status, status, target?.id || null, target ? (text(target.eventName) || text(target.track)) : null, notes, sanctionId, seasonId).run()
      }
      return json({ report: await seasonPayload(db, seasonId) })
    }
    return json({ error: 'Unknown Cup penalty action.' }, 400)
  } catch (error) {
    console.error(JSON.stringify({ message: 'Cup penalty admin update failed.', error: error instanceof Error ? error.message : String(error) }))
    return json({ error: error instanceof Error ? error.message : 'Cup penalty update failed.' }, 400)
  }
}
