import assert from 'node:assert/strict'
import test from 'node:test'
import { scheduledRacePairs } from './cupResultMapping.ts'

test('Cup results use configured SRH result IDs instead of numeric ID order', () => {
  const schedule = [
    { round: 1, track: 'Phoenix', resultId: 350549 },
    { round: 2, track: 'Las Vegas', resultId: 342413 },
    { round: 3, track: 'Darlington' },
  ]

  const pairs = scheduledRacePairs([342413, 350549, 351000], schedule)

  assert.deepEqual(
    pairs.map(({ raceId, scheduled }) => [scheduled.track, raceId]),
    [['Phoenix', 350549], ['Las Vegas', 342413], ['Darlington', 351000]],
  )
})
