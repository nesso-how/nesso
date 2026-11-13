import assert from 'node:assert/strict'
import test from 'node:test'
import { scene, settle, type KnowledgeGraphLayout } from './layout.ts'

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

test('new concepts start beside a placed neighbor and heat grows with their share', () => {
  const layout: KnowledgeGraphLayout = new Map()
  settle(graph, layout)
  const grown = scene(
    {
      concepts: [...graph.concepts, { id: 'urn:e', label: 'e' }],
      relations: [...graph.relations, { source: 'urn:e', predicate: 'urn:p', target: 'urn:d' }],
    },
    layout,
  )
  const [d, e] = ['urn:d', 'urn:e'].map((id) => grown.bubbles.find((bubble) => bubble.id === id)!)
  assert.ok(Math.hypot(e.x! - d.x!, e.y! - d.y!) < 96)
  assert.equal(grown.heat, 0.3)
  assert.equal(scene(graph, new Map()).heat, 1)
})
