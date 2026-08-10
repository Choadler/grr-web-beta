import fs from 'node:fs'
import path from 'node:path'
import { historicalGtRosters } from './gt-history-rosters.mjs'

const root = process.argv[2]
if (!root) throw new Error('Pass the extracted GT historical-data directory.')

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

const aliases = new Map([
  ['giancarlo schliemann', 'giancarlo moneti schliemann'],
  ['rene sandoval', 'rene cota sandoval'],
  ['scott j lindgren', 'scott lindgren'],
  ['manuel dona', 'manuel dona'],
  ['jd daniel', 'j d daniel'],
  ['david k hall', 'david hall'],
  ['andrew j lau', 'andrew lau'],
  ['tyler manwes', 'tyler manawes'],
  ['tyhler cook', 'tyhler cook'],
  ['richard meyers', 'richard myers'],
  ['alexander papadimitriou', 'alex papadimitriou'],
  ['sakib rashid', 'sahib rashid'],
  ['joaquin rafael machado', 'joaquin machado'],
  ['matt n parker', 'matt parker'],
  ['josh p cummings', 'josh cummings'],
  ['mark l thompson', 'mark thompson'],
  ['joshua e miller', 'joshua miller'],
  ['daniel a doan', 'daniel doan'],
  ['chris w stewart', 'chris stewart'],
  ['william c rasmussen', 'william rasmussen'],
  ['harrison holliday', 'harrison holiday'],
  ['shane mathews', 'shane matthews'],
  ['tyler t johnson', 'tyler johnson'],
])
const canonical = (value) => aliases.get(normalize(value)) ?? normalize(value)

for (const [season, classes] of Object.entries(historicalGtRosters)) {
  const folder = season === '6.5' ? 'S6.5' : `S${season}`
  const files = fs.readdirSync(path.join(root, folder)).filter((name) => name.endsWith('.json'))
  const roster = new Map()
  for (const [classKey, names] of Object.entries(classes)) {
    for (const name of names) {
      const key = canonical(name)
      const memberships = roster.get(key) ?? []
      memberships.push({ classKey, name })
      roster.set(key, memberships)
    }
  }
  const participants = new Map()
  const scored = new Map()
  for (const filename of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, folder, filename), 'utf8'))
    const data = payload.data ?? payload
    const race = data.session_results?.find((item) => item.simsession_name === 'RACE')
    const resultRows = race?.results ?? []
    const classified = []
    for (const row of resultRows) {
      const key = canonical(row.display_name)
      const item = participants.get(key) ?? { names: new Set(), customerIds: new Set(), carClasses: new Set(), races: [] }
      item.names.add(row.display_name)
      item.customerIds.add(row.cust_id)
      item.carClasses.add(row.car_class_short_name)
      item.races.push(filename)
      participants.set(key, item)
      const memberships = roster.get(key) ?? []
      const isGtp = String(row.car_class_short_name).toLowerCase() === 'gtp'
      const membership = memberships.find((entry) => entry.classKey === (isGtp ? 'gtp' : entry.classKey) && (isGtp ? entry.classKey === 'gtp' : entry.classKey !== 'gtp'))
      if (membership) classified.push({ row, key, membership })
    }
    const leader = resultRows.find((row) => Number(row.finish_position) === 0) ?? resultRows[0]
    const elapsedSeconds = Number(leader?.average_lap || 0) * Number(leader?.laps_complete || 0) / 10000
    const endurance = elapsedSeconds > 3600
    for (const classKey of Object.keys(classes)) {
      const classRows = classified.filter((item) => item.membership.classKey === classKey).sort((a, b) => Number(a.row.finish_position) - Number(b.row.finish_position))
      const fastest = Math.min(...classRows.map((item) => Number(item.row.best_lap_time) || Infinity))
      classRows.forEach((item, index) => {
        const base = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][index] ?? 0
        const racePoints = endurance ? Math.ceil(base * 1.5) : base
        const bonus = Number(item.row.best_lap_time) > 0 && Number(item.row.best_lap_time) === fastest ? 1 : 0
        scored.set(`${item.key}|${classKey}`, (scored.get(`${item.key}|${classKey}`) ?? 0) + racePoints + bonus)
      })
    }
  }
  const missing = [...participants].filter(([key]) => !roster.has(key))
  const absent = [...roster].filter(([key]) => !participants.has(key))
  console.log(`\nSeason ${season}: ${files.length} JSONs, ${roster.size} unique screenshot drivers, ${participants.size} JSON drivers`)
  console.log(`  JSON drivers not matched to a screenshot roster (${missing.length}):`)
  for (const [, item] of missing) console.log(`    ${[...item.names].join(' / ')} [${[...item.carClasses].join(', ')}]`)
  console.log(`  Screenshot drivers with no JSON start (${absent.length}):`)
  for (const [, memberships] of absent) console.log(`    ${memberships.map((item) => `${item.name} (${item.classKey})`).join(' / ')}`)
  console.log('  Reconstructed scoring leaders:')
  for (const [key, points] of [...scored].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${key}: ${points}`)
}
