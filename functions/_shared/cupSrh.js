export const CUP_SRH_SERIES_ID = 12921
export const CUP_SRH_ROOT = 'https://simracerhub.com'

const entities = (value = '') => String(value)
  .replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const integer = (value) => value === null || value === undefined || value === '' ? null : Number.parseInt(value, 10)
const numeric = (value) => value === null || value === undefined || value === '' ? null : Number(value)
const values = (value) => Array.isArray(value) ? value : Object.values(value ?? {})
const displayDriverName = (value) => {
  const name = String(value ?? '').trim()
  if (!name.includes(',')) return name
  const [last, ...rest] = name.split(',')
  return `${rest.join(',').trim()} ${last.trim()}`.trim()
}

export function parseCupRaceIntervals(html) {
  const intervals = new Map()
  const pattern = /\{[^{}]*\brpid:(\d+)[^{}]*\bintv:(-?\d+(?:\.\d+)?)/g
  for (const match of String(html).matchAll(pattern)) {
    const participantId = Number(match[1])
    const interval = Number(match[2])
    if (Number.isFinite(participantId) && Number.isFinite(interval)) intervals.set(participantId, interval)
  }
  return intervals
}

export function applyCupRaceIntervals(event, intervals) {
  return {
    ...event,
    results: event.results.map((row) => ({
      ...row,
      finishInterval: intervals.get(row.srhRaceParticipantId) ?? null,
    })),
  }
}

export function discoverCupSeasons(html) {
  const rows = []
  const pattern = /<a[^>]+href=["'][^"']*season_schedule\.php\?season_id=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi
  for (const match of String(html).matchAll(pattern)) {
    const name = entities(match[2].replace(/<[^>]+>/g, '').trim())
    if (name) rows.push({
      srhSeriesId: CUP_SRH_SERIES_ID,
      srhSeasonId: Number(match[1]),
      id: `srh-${match[1]}`,
      name,
      sourceUrl: `${CUP_SRH_ROOT}/season_schedule.php?season_id=${match[1]}`,
    })
  }
  const scriptPattern = /\{id:(\d+),sname:"((?:\\.|[^"\\])*)"/g
  for (const match of String(html).matchAll(scriptPattern)) {
    let name = match[2]
    try { name = JSON.parse(`"${match[2]}"`) } catch { name = entities(match[2]) }
    rows.push({
      srhSeriesId: CUP_SRH_SERIES_ID,
      srhSeasonId: Number(match[1]),
      id: `srh-${match[1]}`,
      name,
      sourceUrl: `${CUP_SRH_ROOT}/season_schedule.php?season_id=${match[1]}`,
    })
  }
  return [...new Map(rows.map((row) => [row.srhSeasonId, row])).values()]
}

export function normalizeCupSeason(payload) {
  const meta = payload?.lss ?? {}
  if (Number(meta.series_id) !== CUP_SRH_SERIES_ID || !meta.season_id) throw new Error('Unexpected SimRacerHub Cup payload.')
  const seasonId = `srh-${meta.season_id}`
  const drivers = values(payload.rps).map((driver) => ({
    srhDriverId: Number(driver.drid), displayName: displayDriverName(driver.name),
    position: integer(driver.pos2 ?? driver.pos1), points: integer(driver.tpts), starts: integer(driver.starts),
    wins: integer(driver.wins), stageWins: integer(driver.swins), poles: integer(driver.poles),
    top5: integer(driver.t5), top10: integer(driver.t10), lapsLed: integer(driver.led),
  })).filter((driver) => driver.srhDriverId && driver.displayName)
  const driverNames = new Map(drivers.map((driver) => [driver.srhDriverId, driver.displayName]))
  const tracks = payload.tracks ?? {}
  const events = values(payload.schedules).map((schedule, index) => {
    const track = tracks[String(schedule.config_id)] ?? {}
    const sessions = Object.entries(schedule.race_id ?? {}).map(([sessionNumber, raceId], sessionIndex) => ({
      srhRaceId: Number(raceId), sessionNumber: Number(sessionNumber), sortOrder: sessionIndex,
      sessionType: sessionNumber === '0.0' ? 'RACE' : Number(sessionNumber) > -1 ? 'SEGMENT' : 'OTHER',
    }))
    const results = sessions.flatMap((session) => values(schedule.drivers?.[String(session.srhRaceId)]).map((row) => ({
      srhRaceParticipantId: Number(row.race_participant_id), srhRaceId: session.srhRaceId,
      srhDriverId: Number(row.driver_id), driverName: driverNames.get(Number(row.driver_id)) ?? '',
      finishPosition: integer(row.finish_pos), startPosition: integer(row.qualify_pos), lapsCompleted: integer(row.num_laps),
      lapsLed: integer(row.laps_led), incidents: integer(row.incidents), status: row.status ?? null,
      fastestLapTime: integer(row.fastest_lap_time), racePoints: integer(row.race_points), stagePoints: integer(row.stage_points),
      bonusPoints: integer(row.bonus_points), penaltyPoints: integer(row.penalty_points), totalPoints: integer(row.total_points),
      averagePosition: numeric(row.avg_pos), passes: integer(row.passes), qualityPasses: integer(row.quality_passes),
    })).filter((row) => row.srhRaceParticipantId && row.srhDriverId))
    return {
      id: `${seasonId}-${schedule.schedule_id}`, srhScheduleId: Number(schedule.schedule_id), round: index + 1,
      raceDate: schedule.race_date ? new Date(Number(schedule.race_date) * 1000).toISOString().slice(0, 10) : null,
      track: String(track.track_name ?? track.name ?? '').trim(), trackConfig: String(track.config_name ?? '').trim(),
      eventName: schedule.event_name ?? null, scheduledLaps: integer(schedule.race_laps),
      pointsCount: schedule.points_count === 'N' ? 0 : 1, sessions, results,
    }
  })
  return { season: { id: seasonId, srhSeasonId: Number(meta.season_id), name: String(meta.season_name), sourceUrl: `${CUP_SRH_ROOT}/season_schedule.php?season_id=${meta.season_id}` }, drivers, events }
}

export function validateCupSeason(normalized) {
  const issues = []
  const eventIds = new Set()
  const participantIds = new Set()
  for (const event of normalized.events) {
    if (eventIds.has(event.srhScheduleId)) issues.push(`Duplicate schedule ${event.srhScheduleId}`)
    eventIds.add(event.srhScheduleId)
    for (const row of event.results) {
      if (participantIds.has(row.srhRaceParticipantId)) issues.push(`Duplicate participant ${row.srhRaceParticipantId}`)
      participantIds.add(row.srhRaceParticipantId)
    }
    const race = event.sessions.find((session) => session.sessionType === 'RACE')
    if (race && !event.results.some((row) => row.srhRaceId === race.srhRaceId && row.finishPosition === 1)) issues.push(`Race ${race.srhRaceId} has no winner`)
  }
  return issues
}
