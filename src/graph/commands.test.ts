import assert from 'node:assert/strict'
import test from 'node:test'
import type { MapGraphSnapshot } from '@nesso-how/core'
import { parseGraph, relationKey, SchemaError } from '@nesso-how/schema'
import {
  copyGraph,
  deleteOperations,
  deletionNeedsConfirmation,
  pasteOperations,
  selectionCoversGraph,
} from './commands.ts'

const graph: MapGraphSnapshot = {
  concepts: [
    {
      id: 'urn:a',
      label: 'Alpha',
      position: { x: 10, y: 20 },
      color: '#ffeeee',
      strikethrough: true,
    },
    { id: 'urn:b', label: 'Beta', position: { x: 110, y: 70 } },
    { id: 'urn:c', label: 'Gamma', position: { x: 210, y: 120 } },
  ],
  relationTypes: [
    { id: 'urn:links', label: 'Links' },
    { id: 'urn:unused', label: 'Unused' },
  ],
  relations: [
    { source: 'urn:a', predicate: 'urn:links', target: 'urn:b' },
    { source: 'urn:b', predicate: 'urn:links', target: 'urn:c' },
  ],
}

test('copy includes internal relations or selected relation endpoints, but not unrelated items', () => {
  const selection = [
    { kind: 'concept' as const, id: 'urn:a' },
    { kind: 'concept' as const, id: 'urn:b' },
  ]
  const text = copyGraph(graph, selection)!
  const { graph: copied, maps } = parseGraph(JSON.parse(text))
  assert.deepEqual(copied, {
    concepts: graph.concepts.slice(0, 2).map(({ id, label }) => ({ id, label })),
    relationTypes: graph.relationTypes.slice(0, 1),
    relations: graph.relations.slice(0, 1),
  })
  assert.deepEqual(maps[0].members, [
    { id: 'urn:a', position: { x: 10, y: 20 }, color: '#ffeeee', strikethrough: true },
    { id: 'urn:b', position: { x: 110, y: 70 } },
  ])
  const read = (value: string) => {
    const { graph, maps } = parseGraph(JSON.parse(value))
    return { graph, members: maps.map(({ members }) => members) }
  }
  assert.deepEqual(
    read(copyGraph(graph, [{ kind: 'relation', id: relationKey(graph.relations[0]) }])!),
    read(text),
  )
  assert.equal(copyGraph(graph, []), null)
  assert.deepEqual(parseGraph(JSON.parse(copyGraph(graph, [selection[0]])!)).graph.relations, [])
  const plain = { ...graph, concepts: graph.concepts.map(({ id, label }) => ({ id, label })) }
  assert.deepEqual(parseGraph(JSON.parse(copyGraph(plain, selection)!)).maps, [])
})

test('paste positions the group at the requested point and rejects non-JSON clipboard data', () => {
  const text = copyGraph(graph, [{ kind: 'relation', id: relationKey(graph.relations[0]) }])!
  const additions = pasteOperations(text, { x: 500, y: 600 }).filter(
    (operation) => operation.kind === 'concept.add',
  )
  assert.deepEqual(
    additions.map((operation) => operation.position),
    [
      { x: 500, y: 600 },
      { x: 600, y: 650 },
    ],
  )
  const pasted = pasteOperations(text)
  const [added] = pasted.flatMap((operation) =>
    operation.kind === 'concept.add' ? [operation.id] : [],
  )
  assert.deepEqual(
    pasted.filter((operation) => operation.kind === 'concept.color'),
    [{ kind: 'concept.color', id: added, value: '#ffeeee' }],
  )
  assert.deepEqual(
    pasted.filter((operation) => operation.kind === 'concept.strikethrough'),
    [{ kind: 'concept.strikethrough', id: added, value: true }],
  )
  assert.equal(
    pasteOperations(text, undefined, 40, false).some(
      (operation) =>
        operation.kind === 'concept.color' ||
        operation.kind === 'concept.strikethrough' ||
        (operation.kind === 'concept.add' && operation.position !== undefined),
    ),
    false,
  )
  assert.throws(() => pasteOperations('not a graph'), SchemaError)
})

test('deletion covers every visible concept regardless of relations or off-map selections', () => {
  const map = { ...graph, concepts: graph.concepts.slice(0, 2) }
  const selected = map.concepts.map(({ id }) => ({ kind: 'concept' as const, id }))
  assert.equal(selectionCoversGraph(selected, map), true)
  assert.equal(
    selectionCoversGraph(
      [...selected, { kind: 'relation', id: 'edge' }, { kind: 'concept', id: 'urn:c' }],
      map,
    ),
    true,
  )
  assert.equal(selectionCoversGraph([selected[0], { kind: 'concept', id: 'urn:c' }], map), false)
  assert.equal(selectionCoversGraph([selected[0], { kind: 'relation', id: 'urn:b' }], map), false)
  assert.equal(selectionCoversGraph([], map), false)
  assert.equal(selectionCoversGraph(selected, { ...map, concepts: [] }), false)
})

test('delete removes shared concepts from the map and the rest from the graph', () => {
  const map = (id: string, ids: string[]) => ({
    id,
    name: id,
    members: ids.map((id) => ({ id, position: { x: 0, y: 0 } })),
  })
  const maps = [map('urn:v1', ['urn:a', 'urn:b']), map('urn:v2', ['urn:a'])]
  const selected = [
    { kind: 'concept' as const, id: 'urn:a' },
    { kind: 'concept' as const, id: 'urn:b' },
    { kind: 'relation' as const, id: relationKey(graph.relations[0]) },
  ]
  const state = (activeMapId: string | null, ids = selected) => ({
    selected: ids,
    workspace: { activeMapId, maps, pinnedMapIds: [], mapGroups: [], viewports: {} },
  })
  assert.deepEqual(deleteOperations(state('urn:v1')), [
    { kind: 'map.membership', mapId: 'urn:v1', conceptId: 'urn:a', included: false },
    { kind: 'concept.remove', id: 'urn:b' },
    { kind: 'relation.remove', id: relationKey(graph.relations[0]) },
  ])
  assert.equal(deleteOperations(state(null))[0].kind, 'concept.remove')
  assert.equal(deletionNeedsConfirmation(state('urn:v1')), false)
  assert.equal(deletionNeedsConfirmation(state(null)), true)
  assert.equal(deletionNeedsConfirmation(state(null, [{ kind: 'concept', id: 'urn:c' }])), false)
})

test('paste after cut reuses surviving concepts and recreates removed ones', () => {
  const text = copyGraph(graph, [
    { kind: 'concept', id: 'urn:a' },
    { kind: 'concept', id: 'urn:b' },
  ])!
  const survivor = { ...graph, concepts: graph.concepts.slice(0, 1), relations: [] }
  const operations = pasteOperations(text, { x: 0, y: 0 }, 40, true, {
    graph: survivor,
    mapId: 'urn:v',
  })
  const added = operations.flatMap((operation) =>
    operation.kind === 'concept.add' ? [operation.id] : [],
  )
  assert.equal(added.length, 1)
  assert.notEqual(added[0], 'urn:b')
  assert.deepEqual(operations[0], {
    kind: 'map.membership',
    mapId: 'urn:v',
    conceptId: 'urn:a',
    included: true,
  })
  assert.ok(
    operations.some(
      (operation) =>
        operation.kind === 'relation.connect' &&
        operation.source === 'urn:a' &&
        operation.target === added[0],
    ),
  )
  const kept = pasteOperations(text, undefined, 40, true, { graph, mapId: 'urn:v' })
  assert.equal(
    kept.some(({ kind }) => kind === 'concept.add' || kind === 'relation.connect'),
    false,
  )
})
