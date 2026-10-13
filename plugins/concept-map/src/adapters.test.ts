import assert from 'node:assert/strict'
import test from 'node:test'
import { Position } from '@xyflow/react'
import type { Graph } from '@nesso/schema'
import { conceptNode, containsPoint, facingSide, indexGraph, outsideEdge, outsideNode, relationEdge } from './adapters.ts'

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
  const indexed = indexGraph(graph)
  for (const [position, source, target] of [
    [{ x: 400, y: 0 }, Position.Right, Position.Left],
    [{ x: -400, y: 0 }, Position.Left, Position.Right],
    [{ x: 0, y: 100 }, Position.Bottom, Position.Top],
    [{ x: 0, y: -100 }, Position.Top, Position.Bottom],
  ] as const) {
    graph.concepts[1].position = position
    const edge = relationEdge(graph.relations[0], false, false, indexed, 'urn:links')
    assert.equal(edge.sourceHandle, source)
    assert.equal(edge.targetHandle, target)
    assert.equal(edge.label, undefined)
    assert.equal(edge.interactionWidth, 18)
  }
  const selected = relationEdge(graph.relations[0], true, true, indexed)
  assert.equal(selected.reconnectable, true)
  assert.equal(relationEdge(graph.relations[0], false, true, indexed).reconnectable, false)
  const multiple = relationEdge(graph.relations[0], true, false, indexed)
  assert.equal(multiple.reconnectable, false)
  assert.equal(multiple.selected, true)
  assert.deepEqual(multiple.style, selected.style)
  assert.equal(selected.label, 'links')
  assert.equal(selected.style?.stroke, 'var(--primary)')
  const loop = relationEdge({ ...graph.relations[0], target: 'urn:a' }, false, false, indexed)
  assert.notEqual(loop.sourceHandle, loop.targetHandle)
  graph.concepts[1].position = { x: 600, y: 100 }
  const resized = relationEdge(graph.relations[0], false, false, indexed, undefined, {
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

test('outside adapters render the rest of the graph as inert decoration', () => {
  const graph: Graph = {
    concepts: [
      { id: 'urn:a', label: 'A', position: { x: 0, y: 0 } },
      { id: 'urn:b', label: 'B', position: { x: 400, y: 0 } },
    ],
    relationTypes: [{ id: 'urn:links', label: 'links' }],
    relations: [{ source: 'urn:a', predicate: 'urn:links', target: 'urn:b' }],
  }
  const indexed = indexGraph(graph)
  const node = outsideNode(graph.concepts[0], { width: 120, height: 50 })
  assert.equal(node.data.label, 'A')
  assert.deepEqual(node.measured, { width: 120, height: 50 })
  assert.equal(node.className, 'graph-outside-node')
  assert.equal(node.selectable, false)
  assert.equal(node.draggable, false)
  assert.equal(node.connectable, false)
  assert.equal(node.deletable, false)
  assert.equal(node.focusable, false)
  assert.deepEqual(node.domAttributes, { 'aria-hidden': true })
  const edge = outsideEdge(graph.relations[0], indexed, 'urn:links')
  assert.equal(edge.className, 'graph-outside-edge')
  assert.equal(edge.label, undefined)
  assert.equal(edge.interactionWidth, 0)
  assert.equal(edge.selectable, false)
  assert.equal(edge.focusable, false)
  assert.equal(edge.deletable, false)
  assert.deepEqual(edge.domAttributes, { 'aria-hidden': true })
  assert.equal(outsideEdge(graph.relations[0], indexed, 'urn:other').label, 'links')
})

test('containsPoint matches the measured concept box', () => {
  const concept = { id: 'urn:a', label: 'A', position: { x: 10, y: 20 } }
  const size = { width: 100, height: 40 }
  assert.equal(containsPoint(concept, size, { x: 10, y: 20 }), true)
  assert.equal(containsPoint(concept, size, { x: 110, y: 60 }), true)
  assert.equal(containsPoint(concept, size, { x: 9, y: 20 }), false)
  assert.equal(containsPoint(concept, size, { x: 10, y: 61 }), false)
})
