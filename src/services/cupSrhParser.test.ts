import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCupRaceIntervals, discoverCupSeasons, normalizeCupSeason, parseCupRaceIntervals, validateCupSeason } from '../../functions/_shared/cupSrh.js'
import { formatCupInterval } from '../../functions/api/cup.js'

test('discovers Cup seasons without guessing IDs', () => {
  const rows = discoverCupSeasons('<a href="season_schedule.php?season_id=26393">Season 1</a><a href="season_schedule.php?season_id=26393">Season 1</a> seasons=[{id:27909,sname:"Winter Season"}]')
  assert.deepEqual(rows.map((row: { srhSeasonId: number }) => row.srhSeasonId), [26393, 27909])
})

test('extracts SRH race intervals by participant ID and attaches them to normalized rows', () => {
  const intervals = parseCupRaceIntervals('drivers=[{id:7,rpid:101,fp:1,intv:0,laps:200},{id:8,rpid:102,fp:2,intv:0.8328,laps:200},{id:9,rpid:103,fp:3,intv:9999.0001,laps:199}]')
  const event = { results: [
    { srhRaceParticipantId: 101 },
    { srhRaceParticipantId: 102 },
    { srhRaceParticipantId: 103 },
  ] }

  assert.deepEqual(applyCupRaceIntervals(event, intervals).results.map((row: { finishInterval: number | null }) => row.finishInterval), [0, 0.8328, 9999.0001])
})

test('formats SRH seconds for same-lap cars and lap counts for lapped cars', () => {
  const leader = { finish_position: 1, laps_completed: 200, finish_interval: 0 }
  assert.equal(formatCupInterval(leader, leader), '—')
  assert.equal(formatCupInterval({ finish_position: 2, laps_completed: 200, finish_interval: 0.8328 }, leader), '+0.833')
  assert.equal(formatCupInterval({ finish_position: 12, laps_completed: 199, finish_interval: 9999.0001 }, leader), '1 Lap')
  assert.equal(formatCupInterval({ finish_position: 16, laps_completed: 197, finish_interval: 29997.0001 }, leader), '3 Laps')
})

test('normalizes race and stage sessions with stable SRH IDs', () => {
  const normalized = normalizeCupSeason({ lss:{series_id:'12921',season_id:'1',season_name:'Test'}, rps:{'7':{drid:'7',name:'Driver, Test',pos2:'1',tpts:'40',starts:'1',wins:'1'}}, tracks:{'9':{track_name:'Track',config_name:'Oval'}}, schedules:[{schedule_id:'11',race_date:1,config_id:'9',points_count:'Y',race_id:{'-0.9':'20','0.0':'21'},drivers:{'20':{'7':{race_participant_id:'100',race_id:'20',driver_id:'7',finish_pos:'1',stage_points:'10'}},'21':{'7':{race_participant_id:'101',race_id:'21',driver_id:'7',finish_pos:'1',qualify_pos:'1',total_points:'40'}}}}] })
  assert.equal(normalized.drivers[0].displayName, 'Test Driver')
  assert.equal(normalized.events[0].sessions[0].sessionType, 'SEGMENT')
  assert.equal(normalized.events[0].results.length, 2)
  assert.deepEqual(validateCupSeason(normalized), [])
})
