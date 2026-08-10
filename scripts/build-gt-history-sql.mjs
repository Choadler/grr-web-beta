import fs from 'node:fs'
import path from 'node:path'
import { historicalGtRosters } from './gt-history-rosters.mjs'

const sourceRoot = process.argv[2]
const outputRoot = process.argv[3]
if (!sourceRoot || !outputRoot)
  throw new Error('Usage: node scripts/build-gt-history-sql.mjs <archive-directory> <output-directory>')

const points = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
const labels = { 'gt3-am': 'GT3 AM', 'gt3-pro': 'GT3 Pro', gtp: 'GTP' }
const productionSeasonIds = {
  '2': 'b122cb66-d9f5-4dc2-ad7f-30f2258aa06e',
  '3': '580280f9-19b2-4c74-898a-a355203385b7',
  '4': 'afcf6497-6392-49b1-ac7f-f76fc100e892',
  '5': '1753d236-10ae-415f-94a6-11cd8b8eeaf7',
  '6': '573b8023-4849-4910-a7d7-967a18a06482',
  '6.5': '7b5c70a3-268d-469f-a49e-67ba39c5bd1c',
  '7': '97d4c29f-2b6b-4b58-9103-4faf4dd5e071',
}
const sql = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\d+$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\b(j|k)\b/g, '')
    .replace(/\s+/g, ' ')
const aliases = new Map(Object.entries({
  'giancarlo schliemann': 'giancarlo moneti schliemann',
  'rene sandoval': 'rene cota sandoval',
  'scott j lindgren': 'scott lindgren',
  'alexander papadimitriou': 'alex papadimitriou',
  'sakib rashid': 'sahib rashid',
  'joaquin rafael machado': 'joaquin machado',
  'matt n parker': 'matt parker',
  'josh p cummings': 'josh cummings',
  'mark l thompson': 'mark thompson',
  'joshua e miller': 'joshua miller',
  'daniel a doan': 'daniel doan',
  'chris w stewart': 'chris stewart',
  'william c rasmussen': 'william rasmussen',
  'harrison holliday': 'harrison holiday',
  'shane mathews': 'shane matthews',
  'tyler t johnson': 'tyler johnson',
  'richard meyers': 'richard myers',
  'jd daniel': 'd daniel',
  'david k hall': 'david hall',
  'andrew j lau': 'andrew lau',
  'tyler manwes': 'tyler manawes',
  'kaden m seevers': 'kaden seevers',
  'fernando a fernandes': 'fernando fernandes',
  'omar v ahmed': 'omar ahmed',
  'michael dietch': 'michael deitch',
  'thorbjrn odin': 'thorbjorn odin',
  'sam v hubbard': 'sam hubbard',
}))
const canonical = (value) => aliases.get(normalize(value)) ?? normalize(value)
const easternDate = (timestamp) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
const interval = (row) => String(number(row.average_lap) * number(row.laps_complete) || row.class_interval || row.interval || '-')

fs.mkdirSync(outputRoot, { recursive: true })
for (const filename of fs.readdirSync(outputRoot))
  if (filename.endsWith('.sql') || filename === 'report.json')
    fs.rmSync(path.join(outputRoot, filename))
const report = []
const combined = []
for (const [season, classRosters] of Object.entries(historicalGtRosters)) {
  const folder = season === '6.5' ? 'S6.5' : `S${season}`
  const seasonId = productionSeasonIds[season]
  const roster = new Map()
  for (const [classKey, names] of Object.entries(classRosters))
    for (const name of names) {
      const entries = roster.get(canonical(name)) ?? []
      entries.push({ classKey, name })
      roster.set(canonical(name), entries)
    }
  const jsonFiles = fs.readdirSync(path.join(sourceRoot, folder))
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort((a, b) => number(a.match(/R(\d+)/i)?.[1]) - number(b.match(/R(\d+)/i)?.[1]))
  const participants = new Map()
  const parsed = jsonFiles.map((filename) => {
    const payload = JSON.parse(fs.readFileSync(path.join(sourceRoot, folder, filename), 'utf8'))
    // This matches the current admin endpoint, which persists JSON.stringify(rawJson).
    const raw = JSON.stringify(payload)
    const data = payload.data ?? payload
    const round = number(filename.match(/R(\d+)/i)?.[1])
    const race = data.session_results?.find((item) => String(item.simsession_name).toUpperCase() === 'RACE')
    if (!round || !race?.results?.length) throw new Error(`${folder}/${filename}: round or race rows missing`)
    for (const row of race.results) {
      const key = canonical(row.display_name)
      const item = participants.get(key) ?? { ids: new Set(), names: new Set(), cars: new Set() }
      item.ids.add(number(row.cust_id)); item.names.add(row.display_name); item.cars.add(row.car_name)
      participants.set(key, item)
    }
    return { filename, raw, data, round, rows: race.results }
  })
  const statements = [
    `INSERT INTO gt_seasons(id,name,status,race_time,timezone,legacy_roster_fallback) VALUES(${sql(seasonId)},${sql(`GT League Season ${season}`)},'archived','20:00','America/New_York',0) ON CONFLICT(id) DO NOTHING;`,
    `DELETE FROM gt_season_classes WHERE season_id=${sql(seasonId)} AND NOT EXISTS(SELECT 1 FROM gt_events WHERE season_id=${sql(seasonId)});`,
    ...Object.keys(classRosters).map((classKey, index) => `INSERT OR IGNORE INTO gt_season_classes(season_id,class_key,label,sort_order) VALUES(${sql(seasonId)},${sql(classKey)},${sql(labels[classKey])},${index + 1});`),
    `DELETE FROM gt_driver_assignments WHERE season_id=${sql(seasonId)} AND NOT EXISTS(SELECT 1 FROM gt_events WHERE season_id=${sql(seasonId)});`,
    `INSERT INTO gt_format_points_configs(season_id,format_key,config_json) VALUES(${sql(seasonId)},'standard',${sql(JSON.stringify({ positions: Array.from({ length: 40 }, (_, index) => ({ position: index + 1, points: points[index] ?? 0 })), poleBonus: 0, fastestLapBonus: 1, lapLedBonus: 0, mostLapsLedBonus: 0 }))}) ON CONFLICT(season_id,format_key) DO NOTHING;`,
    `INSERT INTO gt_format_points_configs(season_id,format_key,config_json) VALUES(${sql(seasonId)},'endurance',${sql(JSON.stringify({ positions: Array.from({ length: 40 }, (_, index) => ({ position: index + 1, points: Math.ceil((points[index] ?? 0) * 1.5) })), poleBonus: 0, fastestLapBonus: 1, lapLedBonus: 0, mostLapsLedBonus: 0 }))}) ON CONFLICT(season_id,format_key) DO NOTHING;`,
  ]
  let pendingId = -1
  for (const [key, memberships] of roster) {
    const participant = participants.get(key)
    const customerId = [...(participant?.ids ?? [])].find((id) => id > 0) ?? pendingId--
    const car = [...(participant?.cars ?? [])].at(-1) ?? ''
    for (const membership of memberships)
      statements.push(`INSERT INTO gt_driver_assignments(season_id,customer_id,driver_name,class_key,team_name,car_name) VALUES(${sql(seasonId)},${customerId},${sql(membership.name)},${sql(membership.classKey)},'',${sql(car)}) ON CONFLICT(season_id,customer_id,class_key) DO NOTHING;`)
  }
  const setupSql = `${statements.join('\n')}\n`
  fs.writeFileSync(path.join(outputRoot, `${seasonId}-setup.sql`), setupSql)
  combined.push(setupSql)
  const missing = new Map()
  for (const event of parsed) {
    const eventId = `${seasonId}-round-${event.round}`
    const importId = `${seasonId}-subsession-${event.data.subsession_id}`
    const leader = event.rows.find((row) => number(row.finish_position) === 0) ?? event.rows[0]
    const elapsedSeconds = number(leader.average_lap) * number(leader.laps_complete) / 10000
    const endurance = elapsedSeconds > 3600
    const classified = []
    for (const row of event.rows) {
      const key = canonical(row.display_name)
      const memberships = roster.get(key) ?? []
      const gtp = String(row.car_class_short_name).toLowerCase() === 'gtp'
      const membership = memberships.find((item) => gtp ? item.classKey === 'gtp' : item.classKey !== 'gtp')
      if (!membership) {
        const item = missing.get(key) ?? { name: row.display_name, files: [] }
        item.files.push(event.filename); missing.set(key, item); continue
      }
      classified.push({ row, membership })
    }
    const resultStatements = []
    for (const classKey of Object.keys(classRosters)) {
      const classRows = classified.filter((item) => item.membership.classKey === classKey)
        .sort((a, b) => number(a.row.finish_position) - number(b.row.finish_position))
      const fastest = Math.min(...classRows.map((item) => number(item.row.best_lap_time) || Infinity))
      const poleStart = Math.min(...classRows.map((item) => number(item.row.starting_position) || Infinity))
      classRows.forEach(({ row, membership }, index) => {
        const base = endurance ? Math.ceil((points[index] ?? 0) * 1.5) : points[index] ?? 0
        const fastestLap = number(row.best_lap_time) > 0 && number(row.best_lap_time) === fastest
        const total = base + (fastestLap ? 1 : 0)
        resultStatements.push(`INSERT INTO gt_results(import_id,season_id,event_id,customer_id,driver_name,class_key,class_position,overall_position,start_position,finish_interval,laps_completed,laps_led,incidents,status,best_lap_time,pole,fastest_lap,team_name,car_name,base_points,bonus_points,penalty_points,total_points) VALUES(${sql(importId)},${sql(seasonId)},${sql(eventId)},${number(row.cust_id) || 'NULL'},${sql(membership.name)},${sql(classKey)},${index + 1},${number(row.finish_position) + 1},${number(row.starting_position) + 1},${sql(interval(row))},${number(row.laps_complete)},${number(row.laps_lead)},${number(row.incidents)},${sql(row.reason_out || 'Running')},${number(row.best_lap_time)},${number(row.starting_position) === poleStart ? 1 : 0},${fastestLap ? 1 : 0},'',${sql(row.car_name || '')},${base},${fastestLap ? 1 : 0},0,${total}) ON CONFLICT(import_id,customer_id,driver_name,class_key) DO NOTHING;`)
      })
    }
    const track = String(event.data.track?.track_name ?? 'Unknown track')
    const config = String(event.data.track?.config_name ?? '')
    const eventSql = [
      `INSERT INTO gt_events(id,season_id,round_number,race_date,track,track_config,laps,race_format,status,subsession_id) VALUES(${sql(eventId)},${sql(seasonId)},${event.round},${sql(easternDate(event.data.start_time))},${sql(track)},${sql(config)},${number(event.data.event_laps_complete)},${sql(endurance ? 'endurance' : 'standard')},'completed',${number(event.data.subsession_id)}) ON CONFLICT(season_id,round_number) DO NOTHING;`,
      `INSERT INTO gt_imports(id,season_id,event_id,subsession_id,filename,raw_json) VALUES(${sql(importId)},${sql(seasonId)},${sql(eventId)},${number(event.data.subsession_id)},${sql(event.filename)},'') ON CONFLICT(id) DO NOTHING;`,
      ...Array.from({ length: Math.ceil(event.raw.length / 40000) }, (_, index) => {
        const offset = index * 40000
        return `UPDATE gt_imports SET raw_json=raw_json||${sql(event.raw.slice(offset, offset + 40000))} WHERE id=${sql(importId)} AND length(raw_json)=${offset};`
      }),
      ...resultStatements,
    ]
    const roundSql = `${eventSql.join('\n')}\n`
    fs.writeFileSync(path.join(outputRoot, `${seasonId}-round-${String(event.round).padStart(2, '0')}.sql`), roundSql)
    combined.push(roundSql)
  }
  report.push({ season, seasonId, classes: Object.fromEntries(Object.entries(classRosters).map(([key, names]) => [key, names.length])), jsonFiles: jsonFiles.length, unmatchedJsonDrivers: [...missing.values()].map((item) => ({ ...item, files: [...new Set(item.files)] })) })
}
fs.writeFileSync(path.join(outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
fs.writeFileSync(path.join(outputRoot, 'all.sql'), combined.join('\n'))
console.log(JSON.stringify(report, null, 2))
