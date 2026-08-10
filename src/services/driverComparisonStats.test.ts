import assert from 'node:assert/strict'
import test from 'node:test'
import type { ComparisonDataset, ComparisonRace, DriverOption } from '../types/driverComparison.ts'
import { calculateDriverComparison, comparisonDriverOptions } from './driverComparisonStats.ts'
import { reconcileVerifiedDriverAliases } from './driverComparisonStats.ts'
import { canonicalGtTrackName } from './gtTrackNames.ts'

const a: DriverOption = { key: 'name:driver a', name: 'Driver A', starts: 0 }
const b: DriverOption = { key: 'name:driver b', name: 'Driver B', starts: 0 }
const result = (driver: DriverOption, finish: number, extra = {}) => ({
  driverKey: driver.key,
  driverName: driver.name,
  sourceDriverId: driver.key,
  finish,
  start: finish,
  lapsLed: 0,
  ...extra,
})
const race = (
  key: string,
  series: ComparisonRace['series'],
  results: ComparisonRace['results'],
  extra = {},
): ComparisonRace => ({
  key,
  sourceEventId: key,
  series,
  seasonKey: `${series}:s1`,
  seasonName: 'Season 1',
  date: `2026-0${key.length}-01`,
  track: key.includes('2') ? 'Track Two' : 'Track One',
  resultsUrl: '/results',
  results,
  ...extra,
})
const dataset = (races: ComparisonRace[]): ComparisonDataset => ({ seasons: [], races })
const filters = { series: 'all' as const, season: 'all' }

test('counts only shared races and handles either driver, DNF, ties, form, streaks, and tracks', () => {
  const data = dataset([
    race('r1', 'cup', [result(a, 1), result(b, 4)]),
    race('r2', 'cup', [result(a, 8, { status: 'Running' }), result(b, 3, { status: 'Running' })]),
    race('r3', 'indycar', [result(a, 12, { status: 'DNF' }), result(b, 15, { status: 'DNF' })]),
    race('r4', 'indycar', [result(a, 7), result(b, 7)]),
    race('solo', 'cup', [result(a, 2)]),
  ])
  const comparison = calculateDriverComparison(data, a, b, filters)
  assert.equal(comparison.sharedRaces.length, 4)
  assert.deepEqual([comparison.driverAWins, comparison.driverBWins, comparison.ties], [2, 1, 1])
  assert.deepEqual(comparison.recentForm, ['W', 'L', 'W', 'T'])
  assert.equal(comparison.currentStreak.driver, 'a')
  assert.equal(comparison.currentStreak.races, 1)
  assert.equal(
    comparison.byTrack.reduce((sum, item) => sum + item.races, 0),
    4,
  )
  assert.equal(comparison.careerA.starts, 5)
})

test('applies series and season filters and aggregates all series', () => {
  const data = dataset([
    race('r1', 'cup', [result(a, 1), result(b, 2)]),
    race('r2', 'gt', [result(a, 2), result(b, 1)], { seasonKey: 'gt:s2', date: '2025-01-01' }),
    race('r3', 'indycar', [result(a, 1), result(b, 3)]),
  ])
  assert.equal(calculateDriverComparison(data, a, b, filters).sharedRaces.length, 3)
  assert.equal(
    calculateDriverComparison(data, a, b, { series: 'gt', season: 'all' }).driverBWins,
    1,
  )
  assert.equal(
    calculateDriverComparison(data, a, b, { series: 'all', season: 'year:2025' }).sharedRaces
      .length,
    1,
  )
  assert.equal(
    calculateDriverComparison(data, a, b, { series: 'gt', season: 'gt:s1' }).sharedRaces.length,
    0,
  )
})

test('uses class finish for same-class GT and overall finish across different classes', () => {
  const same = race('same', 'gt', [
    result(a, 1, { className: 'GT3 AM', classFinish: 1, overallFinish: 10 }),
    result(b, 2, { className: 'GT3 AM', classFinish: 2, overallFinish: 11 }),
  ])
  const different = race('different', 'gt', [
    result(a, 1, { className: 'GT3 AM', classFinish: 1, overallFinish: 20 }),
    result(b, 5, { className: 'GTP', classFinish: 5, overallFinish: 5 }),
  ])
  const comparison = calculateDriverComparison(dataset([same, different]), a, b, filters)
  assert.equal(comparison.sharedRaces.find((item) => item.race.key === 'same')?.winner, 'a')
  assert.equal(comparison.sharedRaces.find((item) => item.race.key === 'different')?.winner, 'b')
  assert.equal(
    comparison.sharedRaces.find((item) => item.race.key === 'different')?.differentGtClasses,
    true,
  )
})

test('returns a graceful empty comparison', () => {
  const comparison = calculateDriverComparison(dataset([]), a, b, filters)
  assert.equal(comparison.sharedRaces.length, 0)
  assert.equal(comparison.careerA.averageFinish, null)
  assert.deepEqual(comparison.recentForm, [])
})

test('reconciles display-name aliases that share a stable driver key', () => {
  const blake = { key: 'name:blake doyle', name: 'Blake Doyle', starts: 0 }
  const alias = { ...blake, name: 'Blake Doyle2' }
  const options = comparisonDriverOptions(dataset([
    race('r1', 'gt', [result(blake, 2)]),
    race('r2', 'gt', [result(blake, 3)]),
    race('r3', 'gt', [result(alias, 4)]),
  ]))
  assert.equal(options.length, 1)
  assert.deepEqual(options[0], { key: 'name:blake doyle', name: 'Blake Doyle', starts: 3 })
})

test('carries a customer-ID-verified alias across series', () => {
  const blake = { key: 'name:blake doyle', name: 'Blake Doyle', starts: 0 }
  const alias = { key: 'name:blake doyle2', name: 'Blake Doyle2', starts: 0 }
  const gtOriginal = result(blake, 2)
  const gtAlias = result(alias, 3)
  gtOriginal.sourceDriverId = '667947'
  gtAlias.sourceDriverId = '667947'
  const reconciled = reconcileVerifiedDriverAliases(dataset([
    race('gt-1', 'gt', [gtOriginal]),
    race('gt-2', 'gt', [gtAlias]),
    race('cup-1', 'cup', [result(alias, 4)]),
  ]))
  assert.deepEqual(comparisonDriverOptions(reconciled), [
    { key: 'name:blake doyle', name: 'Blake Doyle', starts: 3 },
  ])
})

test('reconciles shortened and corrected names only when a stable ID verifies them', () => {
  const full = { key: 'name:giancarlo moneti schliemann', name: 'Giancarlo Moneti Schliemann', starts: 0 }
  const short = { key: 'name:giancarlo schliemann', name: 'Giancarlo Schliemann', starts: 0 }
  const unrelated = { key: 'name:giancarlo schliemann jr', name: 'Giancarlo Schliemann Jr', starts: 0 }
  const fullResult = result(full, 1)
  const shortResult = result(short, 2)
  fullResult.sourceDriverId = '631896'
  shortResult.sourceDriverId = '631896'
  const reconciled = reconcileVerifiedDriverAliases(dataset([
    race('gt-1', 'gt', [fullResult]),
    race('gt-2', 'gt', [shortResult]),
    race('cup-1', 'cup', [result(short, 3), result(unrelated, 4)]),
  ]))
  assert.deepEqual(comparisonDriverOptions(reconciled), [
    { key: 'name:giancarlo moneti schliemann', name: 'Giancarlo Moneti Schliemann', starts: 3 },
    { key: 'name:giancarlo schliemann jr', name: 'Giancarlo Schliemann Jr', starts: 1 },
  ])
})

test('standardizes verified GT track aliases without merging distinct layouts', () => {
  assert.equal(canonicalGtTrackName('CTMP'), 'Canadian Tire Motorsports Park')
  assert.equal(canonicalGtTrackName('SPA'), 'Circuit de Spa-Francorchamps')
  assert.equal(canonicalGtTrackName('Watkins Glen'), 'Watkins Glen International')
  assert.equal(canonicalGtTrackName('Nürburgring Combined'), 'Nürburgring Combined')
})
