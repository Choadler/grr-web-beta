import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultRaceSessionIndex, isOverallSession } from '../utils/raceSessionSelection.ts'

test('selects an overall race by meaning instead of session order', () => {
  const event = {
    id: 1,
    label: 'Homestead',
    sessions: [
      { id: 11, label: 'Stage 1', rows: [] },
      { id: 12, label: 'Overall Race Finish', rows: [] },
    ],
  }
  assert.equal(defaultRaceSessionIndex(event), 1)
  assert.equal(isOverallSession(event.sessions[1].label), true)
})

test('retains the first session when no overall result exists', () => {
  assert.equal(defaultRaceSessionIndex({ id: 1, label: 'Race', sessions: [{ id: 11, label: 'Stage 1', rows: [] }] }), 0)
})
