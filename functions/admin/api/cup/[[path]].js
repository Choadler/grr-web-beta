import { CUP_SRH_SERIES_ID, applyCupRaceIntervals, discoverCupSeasons, normalizeCupSeason, parseCupRaceIntervals, validateCupSeason } from '../../../_shared/cupSrh.js'

const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
const srhFetch = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json,text/html' } })
  if (!response.ok) throw new Error(`SimRacerHub request failed (${response.status}).`)
  return response
}
const seasonState = async (db) => (await db.prepare('SELECT id,srh_season_id AS srhSeasonId,name,status,is_complete AS isComplete,source_url AS sourceUrl,last_synced_at AS lastSyncedAt,sync_status AS syncStatus,sync_error AS syncError,chase_enabled AS chaseEnabled,regular_season_races AS regularSeasonRaces,chase_size AS chaseSize,max_points_per_race AS maxPointsPerRace FROM cup_seasons ORDER BY srh_season_id DESC').all()).results

async function discover(db) {
  const html = await (await srhFetch(`https://simracerhub.com/series_seasons.php?series_id=${CUP_SRH_SERIES_ID}`)).text()
  const seasons = discoverCupSeasons(html)
  if (!seasons.length) throw new Error('No Cup seasons were discovered at SimRacerHub.')
  await db.batch(seasons.map((season) => db.prepare(
    `INSERT INTO cup_seasons(id,srh_series_id,srh_season_id,name,status,source_url,sync_status)
     VALUES(?,?,?,?,?,?, 'pending') ON CONFLICT(srh_season_id) DO UPDATE SET name=excluded.name,source_url=excluded.source_url,updated_at=CURRENT_TIMESTAMP`,
  ).bind(season.id, season.srhSeriesId, season.srhSeasonId, season.name, 'archived', season.sourceUrl)))
  return seasons
}

async function syncSeason(db, srhSeasonId) {
  const source = await (await srhFetch(`https://www.simracerhub.com/scoring/get_standings.php?season_id=${srhSeasonId}`)).json()
  const normalized = normalizeCupSeason(source)
  const intervalIssues = []
  const events = []
  for (let index = 0; index < normalized.events.length; index += 6) {
    const batch = normalized.events.slice(index, index + 6)
    events.push(...await Promise.all(batch.map(async (event) => {
      if (!event.results.length) return event
      try {
        const html = await (await srhFetch(`https://www.simracerhub.com/scoring/season_race.php?schedule_id=${event.srhScheduleId}`)).text()
        const intervals = parseCupRaceIntervals(html)
        if (!intervals.size) intervalIssues.push(`Race ${event.srhScheduleId} returned no intervals`)
        return applyCupRaceIntervals(event, intervals)
      } catch (error) {
        intervalIssues.push(`Race ${event.srhScheduleId} intervals failed: ${error instanceof Error ? error.message : 'unknown error'}`)
        return applyCupRaceIntervals(event, new Map())
      }
    })))
  }
  const data = { ...normalized, events }
  const issues = [...validateCupSeason(data), ...intervalIssues]
  const statements = []
  statements.push(db.prepare(`INSERT INTO cup_seasons(id,srh_series_id,srh_season_id,name,status,source_url,last_synced_at,sync_status,sync_error)
    VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,'syncing',NULL) ON CONFLICT(srh_season_id) DO UPDATE SET name=excluded.name,source_url=excluded.source_url,sync_status='syncing',sync_error=NULL,updated_at=CURRENT_TIMESTAMP`)
    .bind(data.season.id, CUP_SRH_SERIES_ID, data.season.srhSeasonId, data.season.name, 'archived', data.season.sourceUrl))
  statements.push(db.prepare(`DELETE FROM cup_events WHERE season_id=? AND TRIM(COALESCE(track,''))='' AND LOWER(COALESCE(event_name,'')) LIKE '%chase%'`).bind(data.season.id))
  for (const driver of data.drivers) {
    statements.push(db.prepare(`INSERT INTO cup_drivers(srh_driver_id,display_name) VALUES(?,?) ON CONFLICT(srh_driver_id) DO UPDATE SET display_name=excluded.display_name,updated_at=CURRENT_TIMESTAMP`).bind(driver.srhDriverId, driver.displayName))
    statements.push(db.prepare(`INSERT INTO cup_standings(season_id,srh_driver_id,championship_position,points,starts,wins,stage_wins,poles,top5,top10,laps_led)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(season_id,srh_driver_id) DO UPDATE SET championship_position=excluded.championship_position,points=excluded.points,starts=excluded.starts,wins=excluded.wins,stage_wins=excluded.stage_wins,poles=excluded.poles,top5=excluded.top5,top10=excluded.top10,laps_led=excluded.laps_led`)
      .bind(data.season.id, driver.srhDriverId, driver.position, driver.points, driver.starts, driver.wins, driver.stageWins, driver.poles, driver.top5, driver.top10, driver.lapsLed))
  }
  for (const event of data.events) {
    statements.push(db.prepare(`INSERT INTO cup_events(id,season_id,srh_schedule_id,round_number,race_date,track,track_config,event_name,scheduled_laps,points_count,source_url)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(srh_schedule_id) DO UPDATE SET round_number=excluded.round_number,race_date=excluded.race_date,track=excluded.track,track_config=excluded.track_config,event_name=COALESCE(cup_events.event_name,excluded.event_name),scheduled_laps=excluded.scheduled_laps,points_count=excluded.points_count`)
      .bind(event.id, data.season.id, event.srhScheduleId, event.round, event.raceDate, event.track, event.trackConfig, event.eventName, event.scheduledLaps, event.pointsCount, `https://simracerhub.com/season_race.php?schedule_id=${event.srhScheduleId}`))
    for (const session of event.sessions) statements.push(db.prepare(`INSERT INTO cup_sessions(srh_race_id,event_id,session_type,session_number,sort_order) VALUES(?,?,?,?,?) ON CONFLICT(srh_race_id) DO UPDATE SET session_type=excluded.session_type,session_number=excluded.session_number,sort_order=excluded.sort_order`).bind(session.srhRaceId, event.id, session.sessionType, session.sessionNumber, session.sortOrder))
    for (const row of event.results) statements.push(db.prepare(`INSERT INTO cup_results(srh_race_participant_id,season_id,event_id,srh_race_id,srh_driver_id,finish_position,start_position,finish_interval,laps_completed,laps_led,incidents,status,fastest_lap_time,race_points,stage_points,bonus_points,penalty_points,total_points,average_position,passes,quality_passes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(srh_race_participant_id) DO UPDATE SET finish_position=excluded.finish_position,start_position=excluded.start_position,finish_interval=excluded.finish_interval,laps_completed=excluded.laps_completed,laps_led=excluded.laps_led,incidents=excluded.incidents,status=excluded.status,fastest_lap_time=excluded.fastest_lap_time,race_points=excluded.race_points,stage_points=excluded.stage_points,bonus_points=excluded.bonus_points,penalty_points=excluded.penalty_points,total_points=excluded.total_points,average_position=excluded.average_position,passes=excluded.passes,quality_passes=excluded.quality_passes`)
      .bind(row.srhRaceParticipantId, data.season.id, event.id, row.srhRaceId, row.srhDriverId, row.finishPosition, row.startPosition, row.finishInterval, row.lapsCompleted, row.lapsLed, row.incidents, row.status, row.fastestLapTime, row.racePoints, row.stagePoints, row.bonusPoints, row.penaltyPoints, row.totalPoints, row.averagePosition, row.passes, row.qualityPasses))
  }
  for (let index = 0; index < statements.length; index += 500) await db.batch(statements.slice(index, index + 500))
  await db.prepare(`UPDATE cup_seasons SET last_synced_at=CURRENT_TIMESTAMP,sync_status=?,sync_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(issues.length ? 'warning' : 'synced', issues.length ? issues.join('; ') : null, data.season.id).run()
  return { season: data.season, races: data.events.length, drivers: data.drivers.length, issues }
}

export async function onRequestGet({ env }) {
  if (!env.INDYCAR_DB) return json({ error: 'Cup history data is not configured.' }, 503)
  return json({ seasons: await seasonState(env.INDYCAR_DB) })
}

export async function onRequestPost({ env, request }) {
  if (!env.INDYCAR_DB) return json({ error: 'Cup history data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  try {
    const body = await request.json()
    if (body.action === 'discover') return json({ discovered: await discover(db), seasons: await seasonState(db) })
    if (body.action === 'sync') return json({ result: await syncSeason(db, Number(body.srhSeasonId)), seasons: await seasonState(db) })
    if (body.action === 'setActive') {
      await db.batch([db.prepare("UPDATE cup_seasons SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE status='active'"), db.prepare("UPDATE cup_seasons SET status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(body.seasonId))])
      return json({ seasons: await seasonState(db) })
    }
    if (body.action === 'setComplete') {
      const seasonId = String(body.seasonId ?? '')
      if (!seasonId) return json({ error: 'A Cup season is required.' }, 400)
      await db.prepare('UPDATE cup_seasons SET is_complete=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(body.isComplete === true ? 1 : 0, seasonId).run()
      return json({ seasons: await seasonState(db) })
    }
    if (body.action === 'configure') {
      const seasonId = String(body.seasonId ?? '')
      const chaseEnabled = body.chaseEnabled === true
      const values = [body.regularSeasonRaces, body.chaseSize, body.maxPointsPerRace].map(Number)
      if (!seasonId) return json({ error: 'A Cup season is required.' }, 400)
      if (values.some((value) => !Number.isInteger(value) || value <= 0)) {
        return json({ error: 'Chase settings must be positive whole numbers.' }, 400)
      }
      await db.prepare(`UPDATE cup_seasons SET chase_enabled=?,regular_season_races=?,chase_size=?,max_points_per_race=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(chaseEnabled ? 1 : 0, ...values, seasonId).run()
      return json({ seasons: await seasonState(db) })
    }
    return json({ error: 'Unknown Cup admin action.' }, 400)
  } catch (error) {
    console.error('Cup SRH admin error', error)
    return json({ error: error instanceof Error ? error.message : 'Cup sync failed.' }, 400)
  }
}
