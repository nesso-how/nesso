import assert from 'node:assert/strict'
import test from 'node:test'
import { Position } from '@xyflow/react'
import type { Graph } from '@nesso/schema'
import { containsPoint, createGraphElements, facingSide, indexGraph, outsideEdge, outsideNode, relationEdge } from './adapters.ts'

test('graph elements preserve dimensions and unchanged identities across snapshots without sharing instance caches', () => {
  const graph: Graph = {
    concepts: [{ id: 'urn:a', label: 'A', position: { x: 0, y: 0 } }, { id: 'urn:b', label: 'B', position: { x: 400, y: 0 } }],
    relationTypes: [{ id: 'urn:links', label: 'links' }],
    relations: [{ source: 'urn:a', predicate: 'urn:links', target: 'urn:b' }],
  }
  const adapt = createGraphElements()
  const options = { selected: [], sizes: { 'urn:a': { width: 350, height: 50 } }, label: () => 'A to B' }
  const before = adapt({ ...options, graph, indexed: indexGraph(graph) })
  const cloned = structuredClone(graph)
  cloned.concepts[0].position.x = 20
  const after = adapt({ ...options, graph: cloned, indexed: indexGraph(cloned) })
  assert.notEqual(after.nodes[0], before.nodes[0])
  assert.deepEqual(after.nodes[0].position, { x: 20, y: 0 })
  assert.deepEqual(after.nodes[0].measured, options.sizes['urn:a'])
  assert.equal(after.nodes[0].measured, before.nodes[0].measured)
  assert.equal(after.nodes[1], before.nodes[1])
  assert.equal(after.edges[0], before.edges[0])
  assert.equal(after.edges, before.edges)
  const repeated = adapt({ ...options, graph: structuredClone(cloned), indexed: indexGraph(cloned) })
  assert.equal(repeated.nodes, after.nodes)
  assert.equal(repeated.edges, after.edges)
  const translated = adapt({ ...options, graph: cloned, indexed: indexGraph(cloned), label: () => 'A verso B' })
  assert.notEqual(translated.edges[0], after.edges[0])
  assert.equal(translated.edges[0].ariaLabel, 'A verso B')
  const selected = adapt({ ...options, graph: cloned, indexed: indexGraph(cloned), selected: [{ kind: 'concept', id: 'urn:b' }] })
  assert.equal(selected.nodes[1].selected, true)
  const isolated = createGraphElements()({ ...options, graph, indexed: indexGraph(graph) })
  assert.notEqual(isolated.nodes[1], before.nodes[1])
  const editing = { enabled: true, id: null as string | null, maxLength: 120, onChange: (_id: string | null) => {} }
  const editable = adapt({ ...options, graph, indexed: indexGraph(graph), editing })
  const active = adapt({ ...options, graph, indexed: indexGraph(graph), editing: { ...editing, id: 'urn:a' } })
  assert.equal(active.nodes[0].data.editing, true)
  assert.equal(active.nodes[0].data.maxLength, editing.maxLength)
  assert.notEqual(active.nodes[0], editable.nodes[0])
  assert.equal(active.nodes[1], editable.nodes[1])
  assert.equal(adapt({ ...options, graph, indexed: indexGraph(graph), editing }).nodes[0].data.editing, false)
  const colored = structuredClone(graph)
  colored.concepts[0].color = '#ff0000'
  const changed = adapt({ ...options, graph: colored, indexed: indexGraph(colored), editing })
  assert.equal(changed.nodes[0].data.color, '#ff0000')
  assert.notEqual(changed.nodes[0], editable.nodes[0])
  assert.equal(changed.nodes[1], editable.nodes[1])
  assert.equal(outsideNode(colored.concepts[0]).data.color, '#ff0000')
  const cleared = adapt({ ...options, graph, indexed: indexGraph(graph), editing })
  assert.equal(cleared.nodes[0].data.color, undefined)
  assert.notEqual(cleared.nodes[0], changed.nodes[0])
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
