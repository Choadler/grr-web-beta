const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } })
const identity = (row) => `id:${row.srhDriverId}`

async function selectedSeason(db, requested) {
  return requested
    ? db.prepare("SELECT id,name,status FROM cup_seasons WHERE id=? AND status<>'draft'").bind(requested).first()
    : db.prepare("SELECT id,name,status FROM cup_seasons WHERE status='active' LIMIT 1").first()
}

export async function onRequestGet({ env, request }) {
  if (!env.INDYCAR_DB) return json({ error: 'Cup history data is not configured.' }, 503)
  const db = env.INDYCAR_DB
  const url = new URL(request.url)
  if (url.searchParams.get('list') === 'seasons') {
    const seasons = await db.prepare(`SELECT s.id,s.name,s.status,s.srh_season_id AS srhSeasonId,s.last_synced_at AS lastSyncedAt,
      (SELECT COUNT(*) FROM cup_events e WHERE e.season_id=s.id) AS races,
      (SELECT COUNT(DISTINCT r.srh_driver_id) FROM cup_results r JOIN cup_sessions cs ON cs.srh_race_id=r.srh_race_id WHERE r.season_id=s.id AND cs.session_type='RACE') AS drivers,
      (SELECT d.display_name FROM cup_standings st JOIN cup_drivers d ON d.srh_driver_id=st.srh_driver_id WHERE st.season_id=s.id AND st.championship_position=1 AND s.status='archived') AS champion
      FROM cup_seasons s WHERE s.status<>'draft' ORDER BY s.srh_season_id DESC`).all()
    return json({ seasons: seasons.results })
  }
  if (url.searchParams.get('view') === 'playoffs') {
    const season = await selectedSeason(db, url.searchParams.get('season'))
    if (!season) return json({ error: 'No public Cup season is available.' }, 404)
    const playoff = await db.prepare(`SELECT ps.format_name AS formatName,ps.championship_round AS championshipRound,ps.source_note AS sourceNote,
      d.srh_driver_id AS championDriverId,d.display_name AS champion
      FROM cup_playoff_seasons ps JOIN cup_drivers d ON d.srh_driver_id=ps.champion_driver_id WHERE ps.season_id=?`).bind(season.id).first()
    if (!playoff) return json({ season, playoffs: null })
    const rounds = (await db.prepare(`SELECT round_key AS roundKey,label,start_round AS startRound,end_round AS endRound,tracks,advancing_count AS advancingCount
      FROM cup_playoff_rounds WHERE season_id=? ORDER BY sort_order`).bind(season.id).all()).results.map((round) => ({ ...round, tracks: round.tracks.split('|') }))
    const drivers = (await db.prepare(`SELECT pd.srh_driver_id AS driverId,d.display_name AS driver,pd.wins,pd.total_points AS totalPoints,
      pd.round_of_12_wins AS roundOf12Wins,pd.round_of_12_points AS roundOf12Points,pd.round_of_8_wins AS roundOf8Wins,pd.round_of_8_points AS roundOf8Points,
      pd.final_cutoff AS finalCutoff,pd.playoff_points AS playoffPoints,pd.outcome
      FROM cup_playoff_drivers pd JOIN cup_drivers d ON d.srh_driver_id=pd.srh_driver_id WHERE pd.season_id=? ORDER BY pd.sort_order`).bind(season.id).all()).results
    return json({ season, playoffs: { ...playoff, rounds, drivers } })
  }
  if (url.searchParams.get('view') === 'history' || url.searchParams.get('view') === 'career') {
    const rows = (await db.prepare(`SELECT r.srh_driver_id AS srhDriverId,d.display_name AS driver,r.season_id AS seasonId,s.name AS season,e.id AS eventId,e.round_number AS round,e.race_date AS date,e.track,
      r.finish_position AS finish,r.start_position AS start,r.laps_completed AS laps,r.laps_led AS lapsLed,r.incidents,r.total_points AS points,r.fastest_lap_time AS fastestLapTime,r.status
      FROM cup_results r JOIN cup_sessions cs ON cs.srh_race_id=r.srh_race_id AND cs.session_type='RACE' JOIN cup_drivers d ON d.srh_driver_id=r.srh_driver_id JOIN cup_seasons s ON s.id=r.season_id AND s.status<>'draft' JOIN cup_events e ON e.id=r.event_id ORDER BY e.race_date,e.round_number,r.finish_position`).all()).results
    const standings = (await db.prepare(`SELECT st.season_id AS seasonId,st.srh_driver_id AS srhDriverId,st.championship_position AS championshipPosition,st.stage_wins AS stageWins,st.poles,s.status AS seasonStatus FROM cup_standings st JOIN cup_seasons s ON s.id=st.season_id AND s.status<>'draft'`).all()).results
    const summary = (selected) => {
      const knownFinish = selected.filter((row) => row.finish != null), knownStart = selected.filter((row) => row.start != null)
      return { starts: selected.length, wins: selected.filter((row) => row.finish === 1).length, top5: selected.filter((row) => row.finish != null && row.finish <= 5).length, top10: selected.filter((row) => row.finish != null && row.finish <= 10).length,
        poles: selected.filter((row) => row.start === 1).length, laps: selected.reduce((sum,row)=>sum+(row.laps||0),0), lapsLed: selected.reduce((sum,row)=>sum+(row.lapsLed||0),0), incidents: selected.reduce((sum,row)=>sum+(row.incidents||0),0), points: selected.reduce((sum,row)=>sum+(row.points||0),0),
        averageStart: knownStart.length ? Number((knownStart.reduce((sum,row)=>sum+row.start,0)/knownStart.length).toFixed(2)) : null, averageFinish: knownFinish.length ? Number((knownFinish.reduce((sum,row)=>sum+row.finish,0)/knownFinish.length).toFixed(2)) : null, bestFinish: knownFinish.length ? Math.min(...knownFinish.map((row)=>row.finish)) : null }
    }
    const groups = new Map()
    rows.forEach((row) => groups.set(row.srhDriverId, [...(groups.get(row.srhDriverId) ?? []), row]))
    if (url.searchParams.get('view') === 'history') return json({ stats: [...groups.values()].map((items) => ({ driverKey: identity(items[0]), driver: items[0].driver, seasons: new Set(items.map((item)=>item.seasonId)).size, ...summary(items) })).sort((a,b)=>b.wins-a.wins||b.starts-a.starts) })
    const key = url.searchParams.get('driver') ?? ''
    const selected = rows.filter((row) => identity(row) === key)
    if (!selected.length) return json({ error: 'That Cup driver was not found.' }, 404)
    const seasonGroups = new Map(); selected.forEach((row)=>seasonGroups.set(row.seasonId,[...(seasonGroups.get(row.seasonId)??[]),row]))
    return json({ driverKey:key,driver:selected[0].driver,seasonsEntered:seasonGroups.size,championships:[...seasonGroups.keys()].filter((seasonId)=>standings.some((item)=>item.seasonId===seasonId&&identity(item)===key&&item.championshipPosition===1&&item.seasonStatus==='archived')).length,...summary(selected),seasons:[...seasonGroups.values()].map((items)=>({seasonId:items[0].seasonId,season:items[0].season,championshipPosition:standingFor(standings,items[0])?.championshipPosition,...summary(items)})),races:selected })
  }
  const season = await selectedSeason(db, url.searchParams.get('season'))
  if (!season) return json({ error: 'No public Cup season is available.' }, 404)
  const events = (await db.prepare('SELECT id,round_number AS round,race_date AS date,track,track_config AS trackConfig,event_name AS eventName,scheduled_laps AS laps,srh_schedule_id AS scheduleId FROM cup_events WHERE season_id=? ORDER BY round_number').bind(season.id).all()).results
  const standings = (await db.prepare(`SELECT st.championship_position AS rank,d.display_name AS driver,st.points,st.starts,st.wins,st.stage_wins AS stageWins,st.poles,st.top5,st.top10,st.laps_led AS lapsLed,st.srh_driver_id AS driverId FROM cup_standings st JOIN cup_drivers d ON d.srh_driver_id=st.srh_driver_id WHERE st.season_id=? ORDER BY st.championship_position`).bind(season.id).all()).results
  const results = (await db.prepare(`SELECT r.*,d.display_name,cs.session_type,cs.sort_order FROM cup_results r JOIN cup_drivers d ON d.srh_driver_id=r.srh_driver_id JOIN cup_sessions cs ON cs.srh_race_id=r.srh_race_id WHERE r.season_id=? ORDER BY r.event_id,cs.sort_order,r.finish_position`).bind(season.id).all()).results
  const raceEvents = events.map((event) => { const eventRows=results.filter((row)=>row.event_id===event.id && row.session_type!=='OTHER'); let stage=0; return { id:event.scheduleId,sourceEventId:event.id,label:`${event.track} — ${event.date ?? 'TBD'}`,track:event.track,date:event.date,sessions:[...new Set(eventRows.map((row)=>row.srh_race_id))].map((raceId)=>{ const raceRows=eventRows.filter((row)=>row.srh_race_id===raceId); const race=raceRows[0]?.session_type==='RACE'; const lapTimes=raceRows.map((row)=>row.fastest_lap_time).filter((value)=>Number(value)>0); const fastestLapTime=lapTimes.length?Math.min(...lapTimes):null; if (!race) stage += 1; return {id:raceId,label:race?'Overall Race Finish':`Stage ${stage}`,rows:raceRows.map((row)=>({position:row.finish_position,driver:row.display_name,start:row.start_position,laps:row.laps_completed,led:row.laps_led,racePoints:row.race_points,stagePoints:row.stage_points,bonus:row.bonus_points,penalty:row.penalty_points,total:row.total_points,incidents:row.incidents,status:row.status??'—',averagePosition:row.average_position,passes:row.passes,quality:row.quality_passes,fastestLap:fastestLapTime!==null&&row.fastest_lap_time===fastestLapTime?1:0}))} }) } }).filter((event)=>event.sessions.length)
  const schedule = events.map((event)=>{ const race=raceEvents.find((item)=>item.sourceEventId===event.id)?.sessions.find((item)=>item.label==='Overall Race Finish'); return {...event,winner:race?.rows.find((row)=>row.position===1)?.driver??'—',pole:race?.rows.find((row)=>row.start===1)?.driver??'—',state:race?'done':'upcoming'} })
  return json({ season, standings, schedule, events:raceEvents, source:'in-house' })
}

const standingFor = (standings, row) => standings.find((item) => item.seasonId === row.seasonId && item.srhDriverId === row.srhDriverId)
