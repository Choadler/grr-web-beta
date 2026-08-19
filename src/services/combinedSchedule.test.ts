import test from 'node:test'
import assert from 'node:assert/strict'
import { googleCalendarUrl, icsCalendar, normalizeScheduleRows, sortSchedule } from './combinedSchedule.ts'

const season = { id: 's1', name: 'Season 1', status: 'active' }

test('combines winner data, multiple GT winners, and results links without inference', () => {
  const rows = normalizeScheduleRows('gt', { season, schedule: [{ eventId: 'e1', date: '2026-08-10', track: 'Spa', state: 'done', gtp: 'A', pro: 'B', am: '—' }], events: [{ sourceEventId: 'e1' }] }, season)
  assert.deepEqual(rows[0].winners, ['A', 'B'])
  assert.equal(rows[0].state, 'completed')
  assert.equal(rows[0].resultsUrl, '/pages/gt-race-results?season=s1&event=e1')
})

test('sorts upcoming nearest first and completed newest first', () => {
  const base = normalizeScheduleRows('indycar', { season, schedule: [{ eventId: 'a', date: '2026-08-20', track: 'A' }, { eventId: 'b', date: '2026-08-10', track: 'B' }] }, season)
  assert.deepEqual(sortSchedule(base, 'upcoming').map((item) => item.name), ['B', 'A'])
  assert.deepEqual(sortSchedule(base, 'completed').map((item) => item.name), ['A', 'B'])
})

test('preserves supported cancellation and postponement statuses', () => {
  const rows = normalizeScheduleRows('indycar', { season, schedule: [{ eventId: 'a', date: '2026-08-20', track: 'A', status: 'cancelled' }, { eventId: 'b', date: '2026-08-21', track: 'B', status: 'postponed' }] }, season)
  assert.deepEqual(rows.map((item) => item.state), ['cancelled', 'postponed'])
})

test('creates encoded Google all-day and timezone-aware calendar links', () => {
  const [event] = normalizeScheduleRows('cup', { season, schedule: [{ id: '1', date: '2026-08-20', track: 'Road & Track' }] }, season)
  const allDay = new URL(googleCalendarUrl(event, 'https://www.grassrootsracing.org')!)
  assert.equal(allDay.searchParams.get('dates'), '20260820/20260821')
  const timed = { ...event, time: '20:30', timezone: 'America/New_York' }
  const google = new URL(googleCalendarUrl(timed, 'https://www.grassrootsracing.org')!)
  assert.equal(google.searchParams.get('dates'), '20260820T203000/20260820T203000')
  assert.equal(google.searchParams.get('ctz'), 'America/New_York')
})

test('generates escaped valid iCalendar content and handles missing dates', () => {
  const [event] = normalizeScheduleRows('cup', { season, schedule: [{ id: '1', date: '2026-08-20', track: 'Road, Track; Layout' }] }, season)
  const ics = icsCalendar(event, 'https://www.grassrootsracing.org')!
  assert.match(ics, /DTSTART;VALUE=DATE:20260820\r\nDTEND;VALUE=DATE:20260821/)
  assert.match(ics, /LOCATION:Road\\, Track\\; Layout/)
  assert.match(ics, /UID:cup:s1:1@grassrootsracing\.org/)
  assert.equal(icsCalendar({ ...event, date: undefined }, 'https://www.grassrootsracing.org'), undefined)
})
