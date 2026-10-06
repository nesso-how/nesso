import assert from 'node:assert/strict'
import test from 'node:test'
import { Position } from '@xyflow/react'
import type { Graph } from '@nesso/schema'
import { conceptNode, facingSide, relationEdge } from '../src/adapters.ts'

test('node adapters retain measured dimensions when their position changes', () => {
  const concept = { id: 'urn:a', label: 'A', position: { x: 0, y: 0 } }
  const measured = { width: 350, height: 50 }
  assert.equal(conceptNode(concept, false).measured, undefined)
  const before = conceptNode(concept, false, measured)
  const after = conceptNode({ ...concept, position: { x: 100, y: 50 } }, true, measured)
  assert.deepEqual(before.measured, measured)
  assert.equal(after.measured, before.measured)
  assert.deepEqual(after.position, { x: 100, y: 50 })
})

test('native edges use facing borders, preserve predicates and keep the default unlabeled', () => {
  const graph: Graph = {
    concepts: [
      { id: 'urn:a', label: 'A', position: { x: 0, y: 0 } },
      { id: 'urn:b', label: 'B', position: { x: 400, y: 0 } },
    ],
    relationTypes: [{ id: 'urn:links', label: 'links' }],
    relations: [{ source: 'urn:a', predicate: 'urn:links', target: 'urn:b' }],
  }
  for (const [position, source, target] of [
    [{ x: 400, y: 0 }, Position.Right, Position.Left],
    [{ x: -400, y: 0 }, Position.Left, Position.Right],
    [{ x: 0, y: 100 }, Position.Bottom, Position.Top],
    [{ x: 0, y: -100 }, Position.Top, Position.Bottom],
  ] as const) {
    graph.concepts[1].position = position
    const edge = relationEdge(graph.relations[0], false, graph, 'urn:links')
    assert.equal(edge.sourceHandle, source)
    assert.equal(edge.targetHandle, target)
    assert.equal(edge.label, undefined)
    assert.equal(edge.interactionWidth, 18)
  }
  const selected = relationEdge(graph.relations[0], true, graph)
  assert.equal(selected.label, 'links')
  assert.equal(selected.style?.stroke, 'var(--primary)')
  const loop = relationEdge({ ...graph.relations[0], target: 'urn:a' }, false, graph)
  assert.notEqual(loop.sourceHandle, loop.targetHandle)
  graph.concepts[1].position = { x: 600, y: 100 }
  const resized = relationEdge(graph.relations[0], false, graph, undefined, {
    'urn:a': { width: 600, height: 50 },
    'urn:b': { width: 120, height: 50 },
  })
  assert.equal(resized.sourceHandle, Position.Bottom)
  assert.equal(resized.targetHandle, Position.Left)
  const source = { position: graph.concepts[0].position, width: 600, height: 50 }
  const pointer = { position: { x: 600, y: 125 }, width: 0, height: 0 }
  assert.equal(facingSide(source, pointer), Position.Bottom)
  assert.equal(facingSide(pointer, source), Position.Left)
})
