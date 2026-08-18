import assert from 'node:assert/strict'
import test from 'node:test'
import { discoverCupSeasons, normalizeCupSeason, validateCupSeason } from '../../functions/_shared/cupSrh.js'

test('discovers Cup seasons without guessing IDs', () => {
  const rows = discoverCupSeasons('<a href="season_schedule.php?season_id=26393">Season 1</a><a href="season_schedule.php?season_id=26393">Season 1</a> seasons=[{id:27909,sname:"Winter Season"}]')
  assert.deepEqual(rows.map((row: { srhSeasonId: number }) => row.srhSeasonId), [26393, 27909])
})

test('normalizes race and stage sessions with stable SRH IDs', () => {
  const normalized = normalizeCupSeason({ lss:{series_id:'12921',season_id:'1',season_name:'Test'}, rps:{'7':{drid:'7',name:'Driver, Test',pos2:'1',tpts:'40',starts:'1',wins:'1'}}, tracks:{'9':{track_name:'Track',config_name:'Oval'}}, schedules:[{schedule_id:'11',race_date:1,config_id:'9',points_count:'Y',race_id:{'-0.9':'20','0.0':'21'},drivers:{'20':{'7':{race_participant_id:'100',race_id:'20',driver_id:'7',finish_pos:'1',stage_points:'10'}},'21':{'7':{race_participant_id:'101',race_id:'21',driver_id:'7',finish_pos:'1',qualify_pos:'1',total_points:'40'}}}}] })
  assert.equal(normalized.drivers[0].displayName, 'Test Driver')
  assert.equal(normalized.events[0].sessions[0].sessionType, 'SEGMENT')
  assert.equal(normalized.events[0].results.length, 2)
  assert.deepEqual(validateCupSeason(normalized), [])
})
