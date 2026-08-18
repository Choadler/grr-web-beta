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
