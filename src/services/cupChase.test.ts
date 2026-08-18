import assert from 'node:assert/strict'
import test from 'node:test'
import { addCupChaseStatus } from './cupChase.ts'

const standings = Array.from({ length: 18 }, (_, index) => ({
  rank: index + 1,
  driver: `Driver ${index + 1}`,
  points: 910 - index * 33,
  starts: 24,
}))

test('adds cutoff values to synced Cup standings', () => {
  const rows = addCupChaseStatus(standings)

  assert.equal(rows[0].cutoff, '+528')
  assert.equal(rows[15].cutoff, '+33')
  assert.equal(rows[16].cutoff, '-33')
})

test('marks a driver clinched only when 17th cannot catch them', () => {
  const rows = addCupChaseStatus(standings)

  assert.equal(rows[11].chase, 'CLINCHED')
  assert.equal(rows[12].chase, 'IN')
  assert.equal(rows[16].chase, '—')
})

test('marks a no-Chase season without calculating a cutoff', () => {
  const rows = addCupChaseStatus(standings, { enabled: false })

  assert.equal(rows[0].chase, 'NO CHASE')
  assert.equal(rows[0].cutoff, '—')
  assert.equal(rows[16].chaseEnabled, 0)
})

test('uses the configured Chase length and field size', () => {
  const rows = addCupChaseStatus(standings, {
    enabled: true,
    regularSeasonRaces: 24,
    chaseSize: 12,
    maxPointsPerRace: 60,
  })

  assert.equal(rows[11].chase, 'CLINCHED')
  assert.equal(rows[12].chase, '—')
  assert.equal(rows[12].cutoff, '-33')
})
