import assert from 'node:assert/strict'
import test from 'node:test'
import { remember, scene, settle, simulation, type KnowledgeGraphLayout } from './layout.ts'

const empty = (): KnowledgeGraphLayout => ({ positions: new Map(), alpha: 0 })

const graph = {
  concepts: ['a', 'b', 'c', 'd'].map((id) => ({ id: `urn:${id}`, label: id })),
  relations: [
    { source: 'urn:a', predicate: 'urn:p', target: 'urn:b' },
    { source: 'urn:b', predicate: 'urn:p', target: 'urn:c' },
    { source: 'urn:c', predicate: 'urn:p', target: 'urn:c' },
  ],
}

test('settle derives the layout from concept IDs and reuses the session cache', () => {
  const first = empty()
  const second = empty()
  const { lines } = settle(graph, first)
  settle(graph, second)
  assert.equal(lines.length, 2)
  assert.deepEqual(second, first)
  const cached = structuredClone(first)
  settle(graph, first)
  assert.deepEqual(first, cached)
})

test('new concepts start beside a placed neighbor and heat grows with their share', () => {
  const layout = empty()
  settle(graph, layout)
  const grown = scene(
    {
      concepts: [...graph.concepts, { id: 'urn:e', label: 'e' }],
      relations: [...graph.relations, { source: 'urn:e', predicate: 'urn:p', target: 'urn:d' }],
    },
    layout.positions,
  )
  const [d, e] = ['urn:d', 'urn:e'].map((id) => grown.bubbles.find((bubble) => bubble.id === id)!)
  assert.ok(Math.hypot(e.x! - d.x!, e.y! - d.y!) < 96)
  assert.equal(grown.heat, 0.3)
  assert.equal(scene(graph, new Map()).heat, 1)
})

test('settle resumes an interrupted layout until it cools', () => {
  const layout = empty()
  const { bubbles, lines, heat } = scene(graph, layout.positions)
  const forces = simulation(bubbles, lines).alpha(heat).tick(10)
  remember(bubbles, layout, forces.alpha())
  const interrupted = structuredClone(layout)
  settle(graph, layout)
  assert.ok(layout.alpha < forces.alphaMin())
  assert.notDeepEqual(layout.positions, interrupted.positions)
})
