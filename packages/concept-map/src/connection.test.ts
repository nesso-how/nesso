import assert from 'node:assert/strict'
import test from 'node:test'
import type { GraphSnapshot } from '@nesso-how/core'
import { canConnect } from './connection.ts'

const graph: GraphSnapshot = { concepts: [], relations: [], relationTypes: [] }
const restriction = { source: 'coffee', target: 'sleep' }

test('guided connections accept only the requested direction and reject every parallel type', () => {
  assert.equal(canConnect(graph, 'coffee', 'sleep', 'default', restriction), true)
  for (const [source, target] of [
    ['sleep', 'coffee'],
    ['coffee', 'energy'],
    ['coffee', 'coffee'],
  ]) {
    assert.equal(canConnect(graph, source, target, 'default', restriction), false)
  }
  const connected = { ...graph, relations: [{ ...restriction, predicate: 'custom' }] }
  assert.equal(canConnect(connected, 'coffee', 'sleep', 'default', restriction), false)
  assert.equal(canConnect(connected, 'coffee', 'sleep', 'default'), true)
  assert.equal(canConnect(connected, 'coffee', 'sleep', 'custom'), false)
})
