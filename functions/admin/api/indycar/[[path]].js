import { scoreIndyRows } from '../../../_shared/leagueScoring.js'

const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

async function state(db) {
  const [seasons, points, schedule, imports, results] = await Promise.all([
    db.prepare('SELECT id,name,status,race_time AS raceTime,timezone FROM indy_seasons ORDER BY created_at DESC').all(),
    db.prepare('SELECT season_id,config_json FROM indy_points_configs').all(),
    db.prepare("SELECT id,season_id AS seasonId,round_number AS round,race_date AS date,track,laps,status,subsession_id AS subsessionId FROM indy_events ORDER BY race_date,round_number").all(),
    db.prepare('SELECT id,season_id AS seasonId,event_id AS eventId,subsession_id AS subsessionId,filename,imported_at AS importedAt FROM indy_imports ORDER BY imported_at').all(),
    db.prepare(`SELECT id,event_id AS eventId,customer_id AS customerId,driver_name AS driver,finish_position AS position,
      start_position AS start,finish_interval AS interval,laps_completed AS laps,laps_led AS lapsLed,incidents,status,
      fastest_lap AS fastestLap,base_points AS racePoints,bonus_points AS bonus,penalty_points AS penalty,total_points AS total
      FROM indy_results ORDER BY event_id,finish_position`).all(),
  ])
  const resultsByEvent = {}
  for (const row of results.results) (resultsByEvent[row.eventId] ??= []).push(row)
  return {
    seasons: seasons.results,
    points: Object.fromEntries(points.results.map((row) => [row.season_id, JSON.parse(row.config_json)])),
    schedule: schedule.results,
    results: resultsByEvent,
    imports: imports.results,
  }
}

export async function onRequestGet({ env, request }) {
  if (!env.INDYCAR_DB) return json({ error: 'INDYCAR_DB is not configured. Bind the D1 database in Cloudflare Pages.' }, 503)
  const importId = new URL(request.url).searchParams.get('import')
  if (importId) {
    const source = await env.INDYCAR_DB.prepare(`SELECT i.id,i.season_id AS seasonId,i.event_id AS eventId,i.filename,i.imported_at AS importedAt,i.raw_json AS rawJson,
      s.name AS seasonName,e.round_number AS round,e.track FROM indy_imports i
      JOIN indy_seasons s ON s.id=i.season_id JOIN indy_events e ON e.id=i.event_id AND e.season_id=i.season_id WHERE i.id=?`).bind(importId).first()
    if (!source) return json({ error: 'That IndyCar import was not found.' }, 404)
    return json({ ...source, rawJson: JSON.parse(source.rawJson) })
  }
  return json(await state(env.INDYCAR_DB))
}

export async function onRequestPost({ request, env }) {
  if (!env.INDYCAR_DB) return json({ error: 'INDYCAR_DB is not configured. Bind the D1 database in Cloudflare Pages.' }, 503)
  const db = env.INDYCAR_DB
  const body = await request.json()
  try {
    if (body.action === 'saveSeason') {
      const item = body.season
      const existing = await db.prepare('SELECT id,status FROM indy_seasons WHERE id=?').bind(item.id).first()
      if (existing?.status === 'active' && item.status !== 'active') return json({ error: 'Set another IndyCar season active before archiving the current public season.' }, 409)
      if (item.status === 'active') await db.prepare("UPDATE indy_seasons SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE status='active' AND id<>?").bind(item.id).run()
      await db.prepare(`INSERT INTO indy_seasons(id,name,status,race_time,timezone) VALUES(?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,race_time=excluded.race_time,timezone=excluded.timezone,updated_at=CURRENT_TIMESTAMP`)
        .bind(item.id, item.name, item.status, item.raceTime, item.timezone).run()
      if (!existing && body.copyFrom) {
        const statements = []
        if (body.copy?.settings) {
          const sourcePoints = await db.prepare('SELECT config_json FROM indy_points_configs WHERE season_id=?').bind(body.copyFrom).first()
          if (sourcePoints) statements.push(db.prepare('INSERT INTO indy_points_configs(season_id,config_json) VALUES(?,?)').bind(item.id, sourcePoints.config_json))
        }
        if (body.copy?.schedule) {
          const sourceEvents = await db.prepare('SELECT round_number,race_date,track,laps FROM indy_events WHERE season_id=? ORDER BY round_number').bind(body.copyFrom).all()
          for (const event of sourceEvents.results) statements.push(db.prepare("INSERT INTO indy_events(id,season_id,round_number,race_date,track,laps,status) VALUES(?,?,?,?,?,?,'scheduled')").bind(crypto.randomUUID(), item.id, event.round_number, event.race_date, event.track, event.laps))
        }
        if (statements.length) await db.batch(statements)
      }
    } else if (body.action === 'savePoints') {
      await db.prepare(`INSERT INTO indy_points_configs(season_id,config_json) VALUES(?,?)
        ON CONFLICT(season_id) DO UPDATE SET config_json=excluded.config_json,updated_at=CURRENT_TIMESTAMP`)
        .bind(body.seasonId, JSON.stringify(body.points)).run()
      const resultData = await db.prepare(`SELECT id,event_id AS eventId,customer_id AS customerId,driver_name AS driver,finish_position AS position,
        start_position AS start,laps_led AS lapsLed,penalty_points AS penalty FROM indy_results WHERE season_id=? ORDER BY event_id,finish_position`).bind(body.seasonId).all()
      const byEvent = new Map()
      for (const row of resultData.results) {
        const rows = byEvent.get(row.eventId) ?? []
        rows.push(row)
        byEvent.set(row.eventId, rows)
      }
      for (const [eventId, rows] of byEvent) {
        const scored = scoreIndyRows(rows, body.points)
        await db.batch(scored.map((driver) => db.prepare('UPDATE indy_results SET base_points=?,bonus_points=?,penalty_points=?,total_points=? WHERE id=? AND event_id=?')
          .bind(driver.racePoints, driver.bonus, driver.penalty, driver.total, driver.id, eventId)))
      }
    } else if (body.action === 'saveEvent') {
      const item = body.event
      await db.prepare(`INSERT INTO indy_events(id,season_id,round_number,race_date,track,laps,status,subsession_id) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET round_number=excluded.round_number,race_date=excluded.race_date,track=excluded.track,laps=excluded.laps,status=excluded.status,subsession_id=excluded.subsession_id,updated_at=CURRENT_TIMESTAMP`)
        .bind(item.id, item.seasonId, item.round, item.date, item.track, item.laps, item.status, item.subsessionId ?? null).run()
    } else if (body.action === 'deleteEvent') {
      await db.prepare('DELETE FROM indy_events WHERE id=?').bind(body.eventId).run()
    } else if (body.action === 'deleteResults') {
      const target = await db.prepare('SELECT s.status FROM indy_events e JOIN indy_seasons s ON s.id=e.season_id WHERE e.id=?').bind(body.eventId).first()
      if (target?.status === 'archived' && body.archivedOverride !== true) return json({ error: 'Archived IndyCar results are immutable without an explicit override.' }, 409)
      await db.batch([
        db.prepare('DELETE FROM indy_results WHERE event_id=?').bind(body.eventId),
        db.prepare('DELETE FROM indy_imports WHERE event_id=?').bind(body.eventId),
        db.prepare("UPDATE indy_events SET status='scheduled',subsession_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.eventId),
      ])
    } else if (body.action === 'publishResults') {
      const event = await db.prepare('SELECT season_id AS seasonId FROM indy_events WHERE id=?').bind(body.eventId).first()
      if (!event) return json({ error: 'That scheduled event no longer exists.' }, 404)
      if (event.seasonId !== body.seasonId) return json({ error: 'The selected season does not own that event.' }, 409)
      const season = await db.prepare('SELECT status FROM indy_seasons WHERE id=?').bind(body.seasonId).first()
      if (season?.status === 'archived' && body.archivedOverride !== true) return json({ error: 'Archived IndyCar results are immutable without an explicit override.' }, 409)
      const pointsRow = await db.prepare('SELECT config_json FROM indy_points_configs WHERE season_id=?').bind(body.seasonId).first()
      if (!pointsRow) return json({ error: 'Save a points table before publishing results.' }, 400)
      const config = JSON.parse(pointsRow.config_json)
      const drivers = body.preview?.drivers
      if (!Array.isArray(drivers) || !drivers.length) return json({ error: 'No normalized race results were supplied.' }, 400)
      const importId = crypto.randomUUID()
      const scored = scoreIndyRows(drivers, config)
      const statements = [
        db.prepare('DELETE FROM indy_results WHERE event_id=?').bind(body.eventId),
        db.prepare('DELETE FROM indy_imports WHERE event_id=?').bind(body.eventId),
        db.prepare('INSERT INTO indy_imports(id,season_id,event_id,subsession_id,filename,raw_json) VALUES(?,?,?,?,?,?)')
          .bind(importId, body.seasonId, body.eventId, body.preview.subsessionId ?? null, body.filename || 'results.json', JSON.stringify(body.rawJson ?? body.preview)),
        db.prepare("UPDATE indy_events SET status='completed',subsession_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
          .bind(body.preview.subsessionId ?? null, body.eventId),
      ]
      for (const driver of scored) {
        statements.push(db.prepare(`INSERT INTO indy_results(import_id,season_id,event_id,customer_id,driver_name,finish_position,start_position,finish_interval,laps_completed,laps_led,incidents,status,fastest_lap,base_points,bonus_points,total_points)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(importId, body.seasonId, body.eventId, driver.customerId ?? null, driver.driver, driver.position, driver.start, driver.interval || '-', driver.laps, driver.lapsLed, driver.incidents, driver.status, driver.fastestLap ? 1 : 0, driver.racePoints, driver.bonus, driver.total))
      }
      await db.batch(statements)
    } else if (body.action === 'saveResults') {
      const event = await db.prepare('SELECT season_id AS seasonId FROM indy_events WHERE id=?').bind(body.eventId).first()
      if (!event) return json({ error: 'That scheduled event no longer exists.' }, 404)
      const season = await db.prepare('SELECT status FROM indy_seasons WHERE id=?').bind(event.seasonId).first()
      if (season?.status === 'archived' && body.archivedOverride !== true) return json({ error: 'Archived IndyCar results are immutable without an explicit override.' }, 409)
      const pointsRow = await db.prepare('SELECT config_json FROM indy_points_configs WHERE season_id=?').bind(event.seasonId).first()
      if (!pointsRow) return json({ error: 'Save a points table before rescoring results.' }, 400)
      const config = JSON.parse(pointsRow.config_json)
      const rows = Array.isArray(body.results) ? body.results : []
      if (!rows.length) return json({ error: 'No race results were supplied.' }, 400)
      const updates = scoreIndyRows(rows.map((driver, index) => ({ ...driver, position: index + 1 })), config).map((driver) => {
        return db.prepare(`UPDATE indy_results SET finish_position=?,penalty_points=?,base_points=?,bonus_points=?,total_points=? WHERE id=? AND event_id=?`)
          .bind(driver.position, driver.penalty, driver.racePoints, driver.bonus, driver.total, driver.id, body.eventId)
      })
      await db.batch(updates)
    } else return json({ error: 'Unknown admin action.' }, 400)
    return json(await state(db))
  } catch (error) {
    console.error(JSON.stringify({ message: 'IndyCar admin update failed.', error: error instanceof Error ? error.message : String(error) }))
    return json({ error: 'The IndyCar update failed.' }, 400)
  }
}
