import assert from 'node:assert/strict'
import test from 'node:test'
import { Position } from '@xyflow/react'
import {
  relationKey,
  type Concept,
  type Graph as Snapshot,
  type Presentation,
} from '@nesso-how/schema'
import type { Selection } from '@nesso-how/core'
import { groupRelations } from './groups.ts'
import { createGraphElements, facingSide, indexGraph, relationEdge } from './adapters.ts'

type Graph = Omit<Snapshot, 'concepts'> & { concepts: (Concept & Presentation)[] }

test('group adapters preserve identities, expose member relations and expand partial selections', () => {
  const graph: Graph = {
    concepts: [
      { id: 'urn:a', label: 'A', position: { x: 0, y: -160 } },
      { id: 'urn:b', label: 'B', position: { x: 0, y: 0 } },
      { id: 'urn:c', label: 'C', position: { x: 120, y: 0 } },
    ],
    relations: ['urn:b', 'urn:c'].map((target) => ({
      source: 'urn:a',
      predicate: 'urn:p',
      target,
    })),
    relationTypes: [{ id: 'urn:p', label: 'links' }],
  }
  const groups = groupRelations(graph)
  const adapt = createGraphElements()
  const options = {
    graph,
    indexed: indexGraph(graph),
    groups,
    sizes: {},
    label: (relation: Graph['relations'][number]) => `${relation.source} to ${relation.target}`,
  }
  const before = adapt({ ...options, selected: [] })
  assert.equal(before.nodes.length, 4)
  assert.equal(before.nodes[0].type, 'relationGroup')
  assert.equal(before.nodes[0].selectable, false)
  assert.deepEqual(before.nodes[0].measured, {
    width: groups[0].bounds.width,
    height: groups[0].bounds.height,
  })
  assert.equal(before.edges.length, 1)
  assert.equal(before.edges[0].source, 'urn:a')
  assert.deepEqual(before.edges[0].data?.relations, groups[0].relations)
  const repeated = adapt({ ...options, groups: groupRelations(graph), selected: [] })
  assert.equal(repeated.nodes, before.nodes)
  assert.equal(repeated.edges, before.edges)
  const selected: Selection = graph.relations.map((relation) => ({
    kind: 'relation',
    id: relationKey(relation),
  }))
  const grouped = adapt({ ...options, selected }).edges[0]
  assert.equal(grouped.selected, true)
  assert.equal(grouped.reconnectable, 'source')
  const incoming = graph.relations.map(({ source, target }) => ({
    source: target,
    predicate: 'urn:p',
    target: source,
  }))
  const reversed = { ...graph, relations: incoming }
  assert.equal(
    adapt({
      ...options,
      graph: reversed,
      indexed: indexGraph(reversed),
      groups: groupRelations(reversed),
      selected: incoming.map((relation) => ({ kind: 'relation', id: relationKey(relation) })),
    }).edges[0].reconnectable,
    'target',
  )
  const partial = adapt({ ...options, selected: selected.slice(0, 1) })
  assert.equal(partial.nodes.length, 3)
  assert.equal(partial.edges.length, 2)
  assert.equal(partial.edges[0].selected, true)
  assert.equal(partial.edges[1].selected, false)
  const hiddenDefault = adapt({ ...options, selected: [], defaultTypeId: 'urn:p' })
  assert.equal(hiddenDefault.edges[0].label, undefined)
  const moved = structuredClone(graph)
  for (const concept of moved.concepts.slice(1)) {
    concept.position.x += concept.id === 'urn:c' ? 24 : 20
    concept.position.y += 10
  }
  const movedGroups = groupRelations(moved)
  const dragged = adapt({
    ...options,
    graph: moved,
    indexed: indexGraph(moved),
    groups: movedGroups,
    selected: [],
  })
  assert.equal(dragged.nodes[0].id, before.nodes[0].id)
  assert.equal(dragged.edges[0].id, before.edges[0].id)
  assert.deepEqual(dragged.nodes[0].measured, {
    width: movedGroups[0].bounds.width,
    height: movedGroups[0].bounds.height,
  })
})

test('graph elements preserve dimensions and unchanged identities across snapshots without sharing instance caches', () => {
  const graph: Graph = {
    concepts: [
      { id: 'urn:a', label: 'A', position: { x: 0, y: 0 } },
      { id: 'urn:b', label: 'B', position: { x: 400, y: 0 } },
    ],
    relationTypes: [{ id: 'urn:links', label: 'links' }],
    relations: [{ source: 'urn:a', predicate: 'urn:links', target: 'urn:b' }],
  }
  const adapt = createGraphElements()
  const options = {
    selected: [],
    sizes: { 'urn:a': { width: 350, height: 50 } },
    label: () => 'A to B',
  }
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
  const repeated = adapt({
    ...options,
    graph: structuredClone(cloned),
    indexed: indexGraph(cloned),
  })
  assert.equal(repeated.nodes, after.nodes)
  assert.equal(repeated.edges, after.edges)
  const vocab = {
    id: 'example',
    relationTypes: [{ ...graph.relationTypes[0], translations: { it: 'collega' } }],
    defaultTypeId: 'urn:links',
  }
  const translated = adapt({
    ...options,
    graph: cloned,
    indexed: indexGraph(cloned, [vocab], 'it'),
    label: () => 'A verso B',
  })
  assert.notEqual(translated.edges[0], after.edges[0])
  assert.equal(translated.edges[0].ariaLabel, 'A verso B')
  assert.equal(translated.edges[0].label, 'collega')
  const selected = adapt({
    ...options,
    graph: cloned,
    indexed: indexGraph(cloned),
    selected: [{ kind: 'concept', id: 'urn:b' }],
  })
  assert.equal(selected.nodes[1].selected, true)
  const isolated = createGraphElements()({ ...options, graph, indexed: indexGraph(graph) })
  assert.notEqual(isolated.nodes[1], before.nodes[1])
  const editing = {
    enabled: true,
    id: null as string | null,
    maxLength: 120,
    onChange: (_id: string | null) => {},
  }
  const editable = adapt({ ...options, graph, indexed: indexGraph(graph), editing })
  const active = adapt({
    ...options,
    graph,
    indexed: indexGraph(graph),
    editing: { ...editing, id: 'urn:a' },
  })
  assert.equal(active.nodes[0].data.editing, true)
  assert.equal(active.nodes[0].data.maxLength, editing.maxLength)
  assert.notEqual(active.nodes[0], editable.nodes[0])
  assert.equal(active.nodes[1], editable.nodes[1])
  assert.equal(
    adapt({ ...options, graph, indexed: indexGraph(graph), editing }).nodes[0].data.editing,
    false,
  )
  const colored = structuredClone(graph)
  colored.concepts[0].color = '#ff0000'
  const changed = adapt({ ...options, graph: colored, indexed: indexGraph(colored), editing })
  assert.equal(changed.nodes[0].data.color, '#ff0000')
  assert.notEqual(changed.nodes[0], editable.nodes[0])
  assert.equal(changed.nodes[1], editable.nodes[1])
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
    assert.equal(edge.className, `graph-source-${source} graph-target-${target}`)
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

test('selected relation groups expose only shared reconnect anchors and update cached edges', () => {
  const graph: Graph = {
    concepts: ['a', 'b', 'c'].map((id) => ({
      id: `urn:${id}`,
      label: id,
      position: { x: 0, y: 0 },
    })),
    relationTypes: [{ id: 'urn:links', label: 'links' }],
    relations: [
      { source: 'urn:a', predicate: 'urn:links', target: 'urn:b' },
      { source: 'urn:a', predicate: 'urn:links', target: 'urn:c' },
      { source: 'urn:c', predicate: 'urn:links', target: 'urn:b' },
    ],
  }
  const adapt = createGraphElements()
  const edges = (indices: number[], extra: Selection = []) =>
    adapt({
      graph,
      indexed: indexGraph(graph),
      selected: [
        ...indices.map((index) => ({
          kind: 'relation' as const,
          id: relationKey(graph.relations[index]),
        })),
        ...extra,
      ],
      sizes: {},
      label: () => '',
    }).edges
  const single = edges([0])
  assert.deepEqual(
    single.map((edge) => edge.reconnectable),
    [true, false, false],
  )
  const source = edges([0, 1])
  assert.deepEqual(
    source.map((edge) => edge.reconnectable),
    ['source', 'source', false],
  )
  assert.deepEqual(
    edges([0, 2]).map((edge) => edge.reconnectable),
    ['target', false, 'target'],
  )
  assert.ok(edges([1, 2]).every((edge) => edge.reconnectable === false))
  assert.ok(edges([]).every((edge) => edge.reconnectable === false))
  assert.ok(
    edges([0, 1], [{ kind: 'concept', id: 'urn:a' }]).every((edge) => edge.reconnectable === false),
  )
  assert.ok(
    edges([0], [{ kind: 'relation', id: 'missing' }]).every((edge) => edge.reconnectable === false),
  )
  graph.relationTypes.push({ id: 'urn:other', label: 'other' })
  graph.relations[1] = { ...graph.relations[0], predicate: 'urn:other' }
  assert.deepEqual(
    edges([0, 1]).map((edge) => edge.reconnectable),
    [true, true, false],
  )
})
