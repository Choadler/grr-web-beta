import assert from 'node:assert/strict'
import test from 'node:test'
import { activePenaltyBalance, crossedThreshold } from '../../functions/_shared/cupPenalties.js'

test('penalty balance applies incidents, reductions, minimum zero, and appeals', () => {
  assert.equal(activePenaltyBalance([{ adjustment: 3, status: 'ACTIVE' }]), 3)
  assert.equal(activePenaltyBalance([{ adjustment: 3, status: 'ACTIVE' }, { adjustment: -1, status: 'ACTIVE' }]), 2)
  assert.equal(activePenaltyBalance([{ adjustment: -1, status: 'ACTIVE' }]), 0)
  assert.equal(activePenaltyBalance([{ adjustment: 6, status: 'ACTIVE' }, { adjustment: 3, status: 'OVERTURNED' }]), 6)
})

test('threshold sanctions are created only on an upward crossing', () => {
  assert.equal(crossedThreshold(6, 9, 9), true)
  assert.equal(crossedThreshold(9, 9, 9), false)
  assert.equal(crossedThreshold(9, 12, 12), true)
  assert.equal(crossedThreshold(12, 12, 12), false)
  assert.equal(crossedThreshold(12, 6, 12), false)
})

test('served suspension reduction produces the expected active balance', () => {
  assert.equal(activePenaltyBalance([{ adjustment: 12, status: 'ACTIVE' }, { adjustment: -6, status: 'ACTIVE' }]), 6)
})
