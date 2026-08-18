import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateCupCareers } from './cupHistoryStats.ts'

test('aggregates nullable Cup history without inventing missing values', () => {
  const [career] = aggregateCupCareers([
    { driverId: 7, driver: 'Driver', seasonId: 'one', finish: 1, start: 2, laps: 100, led: 20, incidents: 2, points: 40, stageWins: 1 },
    { driverId: 7, driver: 'Driver', seasonId: 'two', finish: null, start: null, laps: null, led: null, incidents: null, points: null },
  ])
  assert.equal(career.seasons, 2)
  assert.equal(career.wins, 1)
  assert.equal(career.averageFinish, 1)
  assert.equal(career.bestFinish, 1)
})
