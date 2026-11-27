import assert from 'node:assert/strict'
import test from 'node:test'
import { growth, summarize } from './stats.ts'

test('summaries report medians, relative spread, and growth exponents', () => {
  assert.deepEqual(summarize([4, 1, 3, 2, 5]), { median: 3, spread: 2 / 3 })
  const points = (exponent: number) =>
    [500, 1000, 2000, 5000].map((size) => ({ size, median: 0.01 * size ** exponent }))
  assert.ok(Math.abs(growth(points(1))! - 1) < 1e-9)
  assert.ok(Math.abs(growth(points(2))! - 2) < 1e-9)
  assert.equal(growth([{ size: 500, median: 1 }]), undefined)
})
