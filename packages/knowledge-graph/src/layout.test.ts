import assert from 'node:assert/strict'
import test from 'node:test'
import { settle, type KnowledgeGraphLayout } from './layout.ts'

const graph = {
  concepts: ['a', 'b', 'c', 'd'].map((id) => ({ id: `urn:${id}`, label: id })),
  relations: [
    { source: 'urn:a', predicate: 'urn:p', target: 'urn:b' },
    { source: 'urn:b', predicate: 'urn:p', target: 'urn:c' },
    { source: 'urn:c', predicate: 'urn:p', target: 'urn:c' },
  ],
}

test('settle derives the layout from concept IDs and reuses the session cache', () => {
  const first: KnowledgeGraphLayout = new Map()
  const second: KnowledgeGraphLayout = new Map()
  const { lines } = settle(graph, first)
  settle(graph, second)
  assert.equal(lines.length, 2)
  assert.deepEqual(second, first)
  const cached = new Map(first)
  settle(graph, first)
  assert.deepEqual(first, cached)
})
