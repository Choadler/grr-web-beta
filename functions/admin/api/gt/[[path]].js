const json = (value, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
const classes = ['gt3-am', 'gt3-pro', 'gtp']

async function state(db) {
  const [seasons, points, schedule, assignments, teams, imports, results] = await Promise.all([
    db
      .prepare(
        'SELECT id,name,status,race_time AS raceTime,timezone FROM gt_seasons ORDER BY created_at DESC',
      )
      .all(),
    db.prepare('SELECT season_id,format_key,config_json FROM gt_format_points_configs').all(),
    db
      .prepare(
        'SELECT id,season_id AS seasonId,round_number AS round,race_date AS date,track,laps,race_format AS format,status,subsession_id AS subsessionId FROM gt_events ORDER BY race_date,round_number',
      )
      .all(),
    db
      .prepare(
        'SELECT id,season_id AS seasonId,customer_id AS customerId,driver_name AS driver,class_key AS classKey,team_name AS team,car_name AS car FROM gt_driver_assignments ORDER BY driver_name',
      )
      .all(),
    db
      .prepare(
        'SELECT id,season_id AS seasonId,team_name AS name,class_key AS classKey,car_name AS car,members_json AS membersJson FROM gt_teams ORDER BY team_name',
      )
      .all(),
    db
      .prepare(
        'SELECT id,season_id AS seasonId,event_id AS eventId,subsession_id AS subsessionId,filename,imported_at AS importedAt FROM gt_imports ORDER BY imported_at',
      )
      .all(),
    db
      .prepare(
        `SELECT id,event_id AS eventId,customer_id AS customerId,driver_name AS driver,class_key AS classKey,class_position AS classPosition,
      overall_position AS overallPosition,start_position AS start,finish_interval AS interval,laps_completed AS laps,laps_led AS lapsLed,incidents,status,
      best_lap_time AS bestLapTime,pole,fastest_lap AS fastestLap,team_name AS team,car_name AS car,base_points AS racePoints,bonus_points AS bonus,
      penalty_points AS penalty,total_points AS total FROM gt_results ORDER BY event_id,class_key,class_position`,
      )
      .all(),
  ])
  const configs = {}
  for (const row of points.results)
    (configs[row.season_id] ??= {})[row.format_key] = JSON.parse(row.config_json)
  const byEvent = {}
  for (const row of results.results) (byEvent[row.eventId] ??= []).push(row)
  return {
    seasons: seasons.results,
    points: configs,
    schedule: schedule.results,
    assignments: assignments.results,
    teams: teams.results.map((team) => {
      const members = JSON.parse(team.membersJson || '[]')
      return {
        ...team,
        memberIds: members.map((item) => Number(item.customerId)).filter(Boolean),
        memberNames: members.map((item) => String(item.driver || '')).filter(Boolean),
      }
    }),
    imports: imports.results,
    results: byEvent,
  }
}

const scoreRows = (drivers, config) => {
  if (!config) throw new Error('Save the selected race format points table before publishing.')
  const output = []
  for (const classKey of classes) {
    const rows = drivers
      .filter((driver) => driver.classKey === classKey)
      .sort((a, b) => Number(a.overallPosition) - Number(b.overallPosition))
    const poleStart = Math.min(...rows.map((row) => Number(row.start) || 9999))
    const fastestDriver = rows
      .filter((row) => Number(row.bestLapTime) > 0)
      .sort(
        (a, b) =>
          Number(a.bestLapTime) - Number(b.bestLapTime) ||
          Number(a.overallPosition) - Number(b.overallPosition),
      )[0]
    const mostLed = Math.max(0, ...rows.map((row) => Number(row.lapsLed) || 0))
    rows.forEach((driver, index) => {
      const classPosition = index + 1
      const pole = Number(driver.start) === poleStart
      const fastestLap = driver === fastestDriver
      const base =
        Number(config.positions.find((rule) => Number(rule.position) === classPosition)?.points) ||
        0
      const bonus =
        (pole ? Number(config.poleBonus) || 0 : 0) +
        (fastestLap ? Number(config.fastestLapBonus) || 0 : 0) +
        (Number(driver.lapsLed) > 0 ? Number(config.lapLedBonus) || 0 : 0) +
        (mostLed > 0 && Number(driver.lapsLed) === mostLed
          ? Number(config.mostLapsLedBonus) || 0
          : 0)
      const penalty = Math.max(0, Number(driver.penalty) || 0)
      output.push({
        ...driver,
        classPosition,
        pole,
        fastestLap,
        racePoints: base,
        bonus,
        penalty,
        total: base + bonus - penalty,
      })
    })
  }
  for (const classKey of classes) {
    const classRows = output.filter((driver) => driver.classKey === classKey)
    const hasValidLap = classRows.some((driver) => Number(driver.bestLapTime) > 0)
    const fastestCount = classRows.filter((driver) => driver.fastestLap).length
    if (hasValidLap && fastestCount !== 1)
      throw new Error(`Could not assign exactly one fastest lap for ${classKey}.`)
    if (!hasValidLap && fastestCount !== 0)
      throw new Error(`A fastest lap was assigned without valid lap data for ${classKey}.`)
  }
  return output
}

const updateScoredRows = async (db, eventId, rows) => {
  if (!rows.length) return
  await db.batch(
    rows.map((driver) =>
      db
        .prepare(
          `UPDATE gt_results SET class_key=?,class_position=?,pole=?,fastest_lap=?,team_name=?,car_name=?,base_points=?,bonus_points=?,penalty_points=?,total_points=? WHERE id=? AND event_id=?`,
        )
        .bind(
          driver.classKey,
          driver.classPosition,
          driver.pole ? 1 : 0,
          driver.fastestLap ? 1 : 0,
          driver.team || '',
          driver.car || '',
          driver.racePoints,
          driver.bonus,
          driver.penalty,
          driver.total,
          driver.id,
          eventId,
        ),
    ),
  )
}

const rescoreSeasonFormat = async (db, seasonId, format, config) => {
  const data = await db
    .prepare(
      `SELECT r.id,r.event_id AS eventId,r.customer_id AS customerId,r.driver_name AS driver,r.class_key AS classKey,
      r.class_position AS classPosition,r.overall_position AS overallPosition,r.start_position AS start,r.finish_interval AS interval,
      r.laps_completed AS laps,r.laps_led AS lapsLed,r.incidents,r.status,r.best_lap_time AS bestLapTime,r.pole,r.fastest_lap AS fastestLap,
      r.team_name AS team,r.car_name AS car,r.base_points AS racePoints,r.bonus_points AS bonus,r.penalty_points AS penalty,r.total_points AS total
      FROM gt_results r JOIN gt_events e ON e.id=r.event_id
      WHERE e.season_id=? AND e.race_format=? ORDER BY r.event_id,r.overall_position`,
    )
    .bind(seasonId, format)
    .all()
  const events = new Map()
  for (const row of data.results) {
    const rows = events.get(row.eventId) ?? []
    rows.push(row)
    events.set(row.eventId, rows)
  }
  for (const [eventId, rows] of events) await updateScoredRows(db, eventId, scoreRows(rows, config))
}

export async function onRequestGet({ env }) {
  if (!env.INDYCAR_DB) return json({ error: 'INDYCAR_DB is not configured.' }, 503)
  return json(await state(env.INDYCAR_DB))
}

export async function onRequestPost({ request, env }) {
  if (!env.INDYCAR_DB) return json({ error: 'INDYCAR_DB is not configured.' }, 503)
  const db = env.INDYCAR_DB
  const body = await request.json()
  try {
    if (body.action === 'saveSeason') {
      const item = body.season
      if (item.status === 'active')
        await db
          .prepare(
            "UPDATE gt_seasons SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE status='active' AND id<>?",
          )
          .bind(item.id)
          .run()
      await db
        .prepare(
          `INSERT INTO gt_seasons(id,name,status,race_time,timezone) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,race_time=excluded.race_time,timezone=excluded.timezone,updated_at=CURRENT_TIMESTAMP`,
        )
        .bind(item.id, item.name, item.status, item.raceTime, item.timezone)
        .run()
    } else if (body.action === 'savePoints') {
      const config = body.points
      await db
        .prepare(
          `INSERT INTO gt_format_points_configs(season_id,format_key,config_json) VALUES(?,?,?) ON CONFLICT(season_id,format_key) DO UPDATE SET config_json=excluded.config_json,updated_at=CURRENT_TIMESTAMP`,
        )
        .bind(body.seasonId, body.format, JSON.stringify(config))
        .run()
      await rescoreSeasonFormat(db, body.seasonId, body.format, config)
    } else if (body.action === 'saveTeam') {
      const team = body.team
      if (!team?.name || !classes.includes(team.classKey))
        return json({ error: 'Team name and class are required.' }, 400)
      const members = (team.memberNames ?? []).map((driver, index) => ({
        driver,
        customerId: Number(team.memberIds?.[index]) || null,
      }))
      const statements = [
        db
          .prepare(
            `INSERT INTO gt_teams(id,season_id,team_name,class_key,car_name,members_json) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET team_name=excluded.team_name,class_key=excluded.class_key,car_name=excluded.car_name,members_json=excluded.members_json,updated_at=CURRENT_TIMESTAMP`,
          )
          .bind(
            team.id,
            team.seasonId,
            team.name,
            team.classKey,
            team.car || '',
            JSON.stringify(members),
          ),
      ]
      for (const member of members) {
        if (member.customerId) {
          statements.push(
            db
              .prepare(
                "UPDATE gt_driver_assignments SET team_name=?,class_key=?,car_name=CASE WHEN ?<>'' THEN ? ELSE car_name END,updated_at=CURRENT_TIMESTAMP WHERE season_id=? AND customer_id=?",
              )
              .bind(
                team.name,
                team.classKey,
                team.car || '',
                team.car || '',
                team.seasonId,
                member.customerId,
              ),
          )
          statements.push(
            db
              .prepare(
                "UPDATE gt_results SET team_name=?,class_key=?,car_name=CASE WHEN ?<>'' THEN ? ELSE car_name END WHERE season_id=? AND customer_id=?",
              )
              .bind(
                team.name,
                team.classKey,
                team.car || '',
                team.car || '',
                team.seasonId,
                member.customerId,
              ),
          )
        }
      }
      await db.batch(statements)
    } else if (body.action === 'deleteTeam') {
      const team = await db
        .prepare('SELECT season_id AS seasonId,team_name AS name FROM gt_teams WHERE id=?')
        .bind(body.teamId)
        .first()
      if (team)
        await db.batch([
          db.prepare('DELETE FROM gt_teams WHERE id=?').bind(body.teamId),
          db
            .prepare(
              "UPDATE gt_driver_assignments SET team_name='' WHERE season_id=? AND team_name=?",
            )
            .bind(team.seasonId, team.name),
        ])
    } else if (body.action === 'saveEvent') {
      const item = body.event
      await db
        .prepare(
          `INSERT INTO gt_events(id,season_id,round_number,race_date,track,laps,race_format,status,subsession_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET round_number=excluded.round_number,race_date=excluded.race_date,track=excluded.track,laps=excluded.laps,race_format=excluded.race_format,status=excluded.status,subsession_id=excluded.subsession_id,updated_at=CURRENT_TIMESTAMP`,
        )
        .bind(
          item.id,
          item.seasonId,
          item.round,
          item.date,
          item.track,
          item.laps,
          item.format || 'standard',
          item.status,
          item.subsessionId ?? null,
        )
        .run()
    } else if (body.action === 'deleteEvent')
      await db.prepare('DELETE FROM gt_events WHERE id=?').bind(body.eventId).run()
    else if (body.action === 'saveAssignment') {
      const item = body.assignment
      await db
        .prepare(
          `INSERT INTO gt_driver_assignments(season_id,customer_id,driver_name,class_key,team_name,car_name) VALUES(?,?,?,?,?,?) ON CONFLICT(season_id,customer_id) DO UPDATE SET driver_name=excluded.driver_name,class_key=excluded.class_key,team_name=excluded.team_name,car_name=excluded.car_name,updated_at=CURRENT_TIMESTAMP`,
        )
        .bind(
          item.seasonId,
          item.customerId,
          item.driver,
          item.classKey,
          item.team || '',
          item.car || '',
        )
        .run()
    } else if (body.action === 'saveAssignments') {
      const items = Array.isArray(body.assignments)
        ? body.assignments.filter((item) => item.customerId && classes.includes(item.classKey))
        : []
      if (!items.length) return json({ error: 'No valid driver assignments were supplied.' }, 400)
      await db.batch(
        items.map((item) =>
          db
            .prepare(
              `INSERT INTO gt_driver_assignments(season_id,customer_id,driver_name,class_key,team_name,car_name) VALUES(?,?,?,?,?,?) ON CONFLICT(season_id,customer_id) DO UPDATE SET driver_name=excluded.driver_name,class_key=excluded.class_key,team_name=excluded.team_name,car_name=excluded.car_name,updated_at=CURRENT_TIMESTAMP`,
            )
            .bind(
              item.seasonId,
              item.customerId,
              item.driver,
              item.classKey,
              item.team || '',
              item.car || '',
            ),
        ),
      )
    } else if (body.action === 'deleteAssignment')
      await db
        .prepare('DELETE FROM gt_driver_assignments WHERE season_id=? AND customer_id=?')
        .bind(body.seasonId, body.customerId)
        .run()
    else if (body.action === 'deleteResults')
      await db.batch([
        db.prepare('DELETE FROM gt_results WHERE event_id=?').bind(body.eventId),
        db.prepare('DELETE FROM gt_imports WHERE event_id=?').bind(body.eventId),
        db
          .prepare(
            "UPDATE gt_events SET status='scheduled',subsession_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(body.eventId),
      ])
    else if (body.action === 'publishResults') {
      const event = await db
        .prepare('SELECT race_format AS format FROM gt_events WHERE id=? AND season_id=?')
        .bind(body.eventId, body.seasonId)
        .first()
      if (!event) return json({ error: 'That event no longer exists.' }, 404)
      const pointRow = await db
        .prepare(
          'SELECT config_json FROM gt_format_points_configs WHERE season_id=? AND format_key=?',
        )
        .bind(body.seasonId, event.format || 'standard')
        .first()
      const drivers = body.drivers
      if (
        !Array.isArray(drivers) ||
        !drivers.length ||
        drivers.some((driver) => !classes.includes(driver.classKey))
      )
        return json({ error: 'Every driver must have a GRR class before publishing.' }, 400)
      const scored = scoreRows(drivers, pointRow ? JSON.parse(pointRow.config_json) : null)
      const importId = crypto.randomUUID()
      const statements = [
        db.prepare('DELETE FROM gt_results WHERE event_id=?').bind(body.eventId),
        db.prepare('DELETE FROM gt_imports WHERE event_id=?').bind(body.eventId),
        db
          .prepare(
            'INSERT INTO gt_imports(id,season_id,event_id,subsession_id,filename,raw_json) VALUES(?,?,?,?,?,?)',
          )
          .bind(
            importId,
            body.seasonId,
            body.eventId,
            body.preview?.subsessionId ?? null,
            body.filename || 'results.json',
            JSON.stringify(body.rawJson ?? body.preview),
          ),
        db
          .prepare(
            "UPDATE gt_events SET status='completed',subsession_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(body.preview?.subsessionId ?? null, body.eventId),
      ]
      for (const driver of scored) {
        if (driver.customerId)
          statements.push(
            db
              .prepare(
                `INSERT INTO gt_driver_assignments(season_id,customer_id,driver_name,class_key,team_name,car_name) VALUES(?,?,?,?,?,?) ON CONFLICT(season_id,customer_id) DO UPDATE SET driver_name=excluded.driver_name,class_key=excluded.class_key,team_name=excluded.team_name,car_name=excluded.car_name,updated_at=CURRENT_TIMESTAMP`,
              )
              .bind(
                body.seasonId,
                driver.customerId,
                driver.driver,
                driver.classKey,
                driver.team || '',
                driver.car || '',
              ),
          )
        statements.push(
          db
            .prepare(
              `INSERT INTO gt_results(import_id,season_id,event_id,customer_id,driver_name,class_key,class_position,overall_position,start_position,finish_interval,laps_completed,laps_led,incidents,status,best_lap_time,pole,fastest_lap,team_name,car_name,base_points,bonus_points,penalty_points,total_points) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
            .bind(
              importId,
              body.seasonId,
              body.eventId,
              driver.customerId ?? null,
              driver.driver,
              driver.classKey,
              driver.classPosition,
              driver.overallPosition,
              driver.start,
              driver.interval || '-',
              driver.laps,
              driver.lapsLed,
              driver.incidents,
              driver.status,
              driver.bestLapTime,
              driver.pole ? 1 : 0,
              driver.fastestLap ? 1 : 0,
              driver.team || '',
              driver.car || '',
              driver.racePoints,
              driver.bonus,
              driver.penalty,
              driver.total,
            ),
        )
      }
      await db.batch(statements)
    } else if (body.action === 'saveResults') {
      const event = await db
        .prepare('SELECT season_id AS seasonId,race_format AS format FROM gt_events WHERE id=?')
        .bind(body.eventId)
        .first()
      if (!event) return json({ error: 'That event no longer exists.' }, 404)
      const pointRow = await db
        .prepare(
          'SELECT config_json FROM gt_format_points_configs WHERE season_id=? AND format_key=?',
        )
        .bind(event.seasonId, event.format || 'standard')
        .first()
      const scored = scoreRows(
        body.results ?? [],
        pointRow ? JSON.parse(pointRow.config_json) : null,
      )
      await updateScoredRows(db, body.eventId, scored)
    } else return json({ error: 'Unknown admin action.' }, 400)
    return json(await state(db))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'The GT update failed.' }, 400)
  }
}
