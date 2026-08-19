import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareGtStandings,
  compareIndyStandings,
  scoreGtRows,
  scoreIndyRows,
  validateScoringDrivers,
} from '../../functions/_shared/leagueScoring.js'

const positions = [
  { position: 1, points: 50 },
  { position: 2, points: 40 },
  { position: 3, points: 30 },
]

test('golden IndyCar race applies position, pole, led, most-led, and penalty points', () => {
  const scored = scoreIndyRows(
    [
      { customerId: 101, driver: 'Alpha', position: 1, start: 2, lapsLed: 20, penalty: 3 },
      { customerId: 102, driver: 'Bravo', position: 2, start: 1, lapsLed: 5, penalty: 0 },
      { customerId: 103, driver: 'Charlie', position: 3, start: 3, lapsLed: 0, penalty: 50 },
    ],
    { positions, poleBonus: 2, lapLedBonus: 1, mostLapsLedBonus: 3 },
  )
  assert.deepEqual(
    scored.map(({ driver, racePoints, bonus, penalty, total }) => ({ driver, racePoints, bonus, penalty, total })),
    [
      { driver: 'Alpha', racePoints: 50, bonus: 4, penalty: 3, total: 51 },
      { driver: 'Bravo', racePoints: 40, bonus: 3, penalty: 0, total: 43 },
      { driver: 'Charlie', racePoints: 30, bonus: 0, penalty: 50, total: -20 },
    ],
  )
})

test('golden GT multiclass race scores each class independently', () => {
  const scored = scoreGtRows(
    [
      { customerId: 201, driver: 'Prototype A', classKey: 'gtp', overallPosition: 1, start: 1, bestLapTime: 1000, lapsLed: 10, penalty: 0 },
      { customerId: 301, driver: 'GT A', classKey: 'gt3-am', overallPosition: 2, start: 3, bestLapTime: 1200, lapsLed: 4, penalty: 2 },
      { customerId: 202, driver: 'Prototype B', classKey: 'gtp', overallPosition: 3, start: 2, bestLapTime: 990, lapsLed: 0, penalty: 0 },
      { customerId: 302, driver: 'GT B', classKey: 'gt3-am', overallPosition: 4, start: 4, bestLapTime: 1190, lapsLed: 1, penalty: 0 },
    ],
    { positions, poleBonus: 2, fastestLapBonus: 5, lapLedBonus: 1, mostLapsLedBonus: 3 },
    ['gt3-am', 'gt3-pro', 'gtp'],
  )
  assert.deepEqual(
    scored.map(({ driver, classPosition, pole, fastestLap, racePoints, bonus, penalty, total }) => ({ driver, classPosition, pole, fastestLap, racePoints, bonus, penalty, total })),
    [
      { driver: 'GT A', classPosition: 1, pole: true, fastestLap: false, racePoints: 50, bonus: 6, penalty: 2, total: 54 },
      { driver: 'GT B', classPosition: 2, pole: false, fastestLap: true, racePoints: 40, bonus: 6, penalty: 0, total: 46 },
      { driver: 'Prototype A', classPosition: 1, pole: true, fastestLap: false, racePoints: 50, bonus: 6, penalty: 0, total: 56 },
      { driver: 'Prototype B', classPosition: 2, pole: false, fastestLap: true, racePoints: 40, bonus: 5, penalty: 0, total: 45 },
    ],
  )
})

test('rejects duplicate stable driver identities and malformed finishes', () => {
  assert.throws(
    () => validateScoringDrivers([{ customerId: 7, driver: 'Name A', position: 1 }, { customerId: 7, driver: 'Name B', position: 2 }]),
    /Duplicate result row/,
  )
  assert.throws(() => validateScoringDrivers([{ customerId: 8, driver: 'Name', position: 0 }]), /positive integer/)
})

test('GT standings follow the published complete tie-break order', () => {
  const base = { points: 100, wins: 1, secondPlaces: 1, poles: 1, finalRaceFinish: 5 }
  const entries = [
    { ...base, driver: 'Final', finalRaceFinish: 4 },
    { ...base, driver: 'Pole', poles: 2 },
    { ...base, driver: 'Second', secondPlaces: 2 },
    { ...base, driver: 'Win', wins: 2 },
    { ...base, driver: 'Base' },
  ]
  assert.deepEqual(entries.sort(compareGtStandings).map((item) => item.driver), ['Win', 'Second', 'Pole', 'Final', 'Base'])
})

test('INDYCAR standings compare wins through last-place finishes, then the previous event', () => {
  const entries = [
    { driver: 'Previous', points: 100, finishCounts: [0, 1, 1, 0], previousEventFinish: 2 },
    { driver: 'Thirds', points: 100, finishCounts: [0, 1, 1, 2], previousEventFinish: 1 },
    { driver: 'Seconds', points: 100, finishCounts: [0, 1, 2, 0], previousEventFinish: 5 },
    { driver: 'Wins', points: 100, finishCounts: [0, 2, 0, 0], previousEventFinish: 8 },
  ]
  assert.deepEqual(entries.sort(compareIndyStandings).map((item) => item.driver), ['Wins', 'Seconds', 'Thirds', 'Previous'])
})

test('most-laps-led ties award only the higher overall finisher', () => {
  const scored = scoreIndyRows([
    { customerId: 1, driver: 'Winner', position: 1, start: 2, lapsLed: 10 },
    { customerId: 2, driver: 'Runner-up', position: 2, start: 1, lapsLed: 10 },
  ], { positions, poleBonus: 0, lapLedBonus: 0, mostLapsLedBonus: 3 })
  assert.deepEqual(scored.map((row) => row.bonus), [3, 0])
})
