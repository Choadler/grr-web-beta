import test from 'node:test'
import assert from 'node:assert/strict'
import { bulkCalendarFilename, googleCalendarUrl, icsCalendar, monthDays, multiEventIcs, normalizeScheduleRows, scheduleDisplay, shiftMonth, sortSchedule, uniqueCalendarEvents, updateScheduleParams, validMonth } from './combinedSchedule.ts'

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

test('defaults to calendar view and preserves filters while switching views', () => {
  assert.equal(scheduleDisplay(null), 'calendar')
  assert.equal(scheduleDisplay('list'), 'list')
  const current = new URLSearchParams('series=gt&season=gt%3As1&history=upcoming')
  const next = updateScheduleParams(current, 'display', 'list', 'calendar')
  assert.equal(next.toString(), 'series=gt&season=gt%3As1&history=upcoming&display=list')
  assert.equal(scheduleDisplay(updateScheduleParams(next, 'display', 'calendar', 'calendar').get('display')), 'calendar')
  const legacy = updateScheduleParams(new URLSearchParams('view=completed&series=cup'), 'history', 'upcoming', 'all')
  assert.equal(legacy.toString(), 'series=cup&history=upcoming')
})

test('supports predictable month navigation, Today fallback, and full month grids', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(validMonth('bad', new Date('2026-08-19T00:00:00Z')), '2026-08')
  const august = monthDays('2026-08')
  assert.equal(august.leading, 6)
  assert.equal(august.days.length, 31)
})

test('keeps multiple races on one date and deduplicates bulk exports by stable event ID', () => {
  const cup = normalizeScheduleRows('cup', { season, schedule: [{ id: '1', date: '2026-08-20', track: 'Cup Track' }] }, season)[0]
  const gt = normalizeScheduleRows('gt', { season, schedule: [{ eventId: '2', date: '2026-08-20', track: 'GT Track' }] }, season)[0]
  assert.equal([cup, gt].filter((event) => event.date === '2026-08-20').length, 2)
  assert.deepEqual(uniqueCalendarEvents([cup, cup, gt]).map((event) => event.id), ['cup:s1:1', 'gt:s1:2'])
  const ics = multiEventIcs([cup, cup, gt], 'https://www.grassrootsracing.org')!
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2)
  assert.match(ics, /UID:cup:s1:1@grassrootsracing\.org/)
  assert.match(ics, /UID:gt:s1:2@grassrootsracing\.org/)
  assert.match(ics, /\r\n /)
})

test('creates league-specific and all-series bulk calendar filenames', () => {
  assert.equal(bulkCalendarFilename('all'), 'grr-all-series-schedule.ics')
  assert.equal(bulkCalendarFilename('indycar'), 'grr-indycar-schedule.ics')
  assert.equal(bulkCalendarFilename('gt'), 'grr-gt-schedule.ics')
})
