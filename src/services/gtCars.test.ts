import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalGtCarName, gtCarNames } from '../config/gtCars.ts'

test('normalizes known GT car shorthand to canonical labels', () => {
  assert.equal(canonicalGtCarName('mclaren gt3'), 'McLaren 720S GT3 EVO')
  assert.equal(canonicalGtCarName('Corvette GT3'), 'Chevrolet Corvette Z06 GT3.R')
  assert.equal(canonicalGtCarName('Mercedes AMG GT3'), 'Mercedes-AMG GT3 2020')
  assert.equal(canonicalGtCarName('  Future Car  '), 'Future Car')
})

test('keeps every canonical GT car label stable', () => {
  const canonical = new Set<string>(gtCarNames)
  assert.equal(canonical.size, gtCarNames.length)
  assert.ok(gtCarNames.every((car) => canonicalGtCarName(car) === car))
})
