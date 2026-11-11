import assert from 'node:assert/strict'
import test from 'node:test'
import { outsideNeighbors } from './neighbors.ts'

test('outsideNeighbors groups relations to concepts outside the view per member', () => {
  const relations = [
    { source: 'a', target: 'x', predicate: 'p' },
    { source: 'x', target: 'a', predicate: 'q' },
    { source: 'b', target: 'y', predicate: 'p' },
    { source: 'a', target: 'b', predicate: 'p' },
    { source: 'a', target: 'a', predicate: 'p' },
    { source: 'x', target: 'y', predicate: 'p' },
  ]
  assert.deepEqual(
    outsideNeighbors(relations, new Set(['a', 'b'])),
    new Map([
      ['a', [{ id: 'x', relations: [relations[0], relations[1]] }]],
      ['b', [{ id: 'y', relations: [relations[2]] }]],
    ]),
  )
})
