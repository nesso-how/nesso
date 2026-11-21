import assert from 'node:assert/strict'
import test from 'node:test'
import { relationKey, serializeGraph, type Graph } from '@nesso-how/schema'
import { NessoError } from '@nesso-how/errors'
import { createNessoStore } from './create.ts'
import { copyGraph, pasteOperations } from '../graph/commands.ts'
import { loadPersistence } from './persistence.ts'

const relation = { source: 'urn:a', predicate: 'urn:p', target: 'urn:b' }
const key = relationKey(relation)
const graph = (): Graph => ({
  concepts: ['urn:a', 'urn:b', 'urn:c', 'urn:d'].map((id) => ({ id, label: id })),
  relationTypes: [
    { id: 'urn:p', label: 'links' },
    { id: 'urn:q', label: 'uses' },
  ],
  relations: [relation, { ...relation, target: 'urn:c' }],
})
const fixture = () => {
  const host = createNessoStore(graph())
  const first = host.store.createMap('First', ['urn:a', 'urn:b', 'urn:c', 'urn:d'])
  const second = host.store.createMap('Second', ['urn:a', 'urn:b'])
  host.store.setMap(first)
  return { ...host, first, second }
}

test('bends are map-local, keep the semantic graph and unchanged objects, and undo in grouped deltas', () => {
  const { store, first, second } = fixture()
  const before = store.getState()
  store.setRelationBend(key, 0.2, 'drag')
  store.setRelationBend(key, 0.4, 'drag')
  const after = store.getState()
  assert.equal(after.graph, before.graph)
  assert.equal(after.mapGraph.concepts, before.mapGraph.concepts)
  assert.equal(after.mapGraph.relations[1], before.mapGraph.relations[1])
  assert.equal(after.mapGraph.relations[0].bend, 0.4)
  store.setRelationBend(key, 0.4)
  store.applyOperations([
    { kind: 'relation.bend', id: key, value: 0.6 },
    { kind: 'relation.bend', id: key, value: 0.4 },
  ])
  assert.equal(store.getState(), after)
  store.setMap(second)
  assert.equal(store.getState().mapGraph.relations[0].bend, undefined)
  store.undo()
  assert.deepEqual(store.getState().workspace.maps, before.workspace.maps)
  store.redo()
  assert.deepEqual(store.getState().workspace.maps, after.workspace.maps)
  assert.equal(store.getState().workspace.activeMapId, second)
  store.setMap(first)
  store.setConceptPosition('urn:a', { x: 300, y: 200 })
  assert.equal(store.getState().mapGraph.relations[0].bend, 0.4)
})

test('retyping preserves bends in every map while reconnection and removals clean them undoably', () => {
  for (const edit of ['type', 'reconnect', 'relation', 'concept', 'membership'] as const) {
    const { store, first, second } = fixture()
    store.applyOperations([
      { kind: 'relation.bend', id: key, value: 0.2 },
      { kind: 'map.activate', id: second },
      { kind: 'relation.bend', id: key, value: -0.3 },
      { kind: 'map.activate', id: first },
    ])
    const before = store.getState()
    if (edit === 'type') store.setRelationType(key, 'urn:q')
    if (edit === 'reconnect') store.reconnectRelation(key, 'urn:a', 'urn:d')
    if (edit === 'relation') store.removeRelation(key)
    if (edit === 'concept') store.removeConcept('urn:b')
    if (edit === 'membership') store.setMapMembership(first, 'urn:b', false)
    const after = store.getState()
    const bends = after.workspace.maps.map((map) => map.relationBends ?? [])
    if (edit === 'type')
      assert.deepEqual(bends, [
        [{ ...relation, predicate: 'urn:q', bend: 0.2 }],
        [{ ...relation, predicate: 'urn:q', bend: -0.3 }],
      ])
    else
      assert.deepEqual(
        bends,
        edit === 'membership' ? [[], [{ ...relation, bend: -0.3 }]] : [[], []],
      )
    store.undo()
    assert.deepEqual(store.getState().workspace.maps, before.workspace.maps)
    assert.deepEqual(store.getState().graph, before.graph)
    store.redo()
    assert.deepEqual(store.getState().workspace.maps, after.workspace.maps)
  }
})

test('invalid bend operations reject complete batches without state or history changes', () => {
  const { store, first } = fixture()
  for (const operation of [
    { kind: 'relation.bend' as const, id: key, value: NaN },
    { kind: 'relation.bend' as const, id: 'missing', value: 0.2 },
  ]) {
    const before = store.getState()
    assert.throws(
      () =>
        store.applyOperations([
          { kind: 'concept.label', id: 'urn:a', value: 'Must not commit' },
          operation,
        ]),
      NessoError,
    )
    assert.equal(store.getState(), before)
  }
  store.setMap(null)
  assert.throws(() => store.setRelationBend(key, 0.2), /No active map/)
  store.setMapMembership(first, 'urn:b', false)
  store.setMap(first)
  assert.throws(() => store.setRelationBend(key, 0.2), /not in the map/)
})

test('clipboard remaps bends', () => {
  const { store } = fixture()
  store.setRelationBend(key, 0.25)
  const copied = copyGraph(store.getState().mapGraph, [{ kind: 'relation', id: key }])!
  store.applyOperations(pasteOperations(copied))
  const added = store.getState().mapGraph.relations.find((relation) => relation.source !== 'urn:a')!
  assert.equal(added.bend, 0.25)
})

test('persisted bends round-trip and invalid references block loading', async () => {
  const { store } = fixture()
  store.setRelationBend(key, 0.25)
  const state = store.getState()
  const record = {
    version: 8,
    documentId: state.documentId,
    graph: serializeGraph(graph()),
    workspace: state.workspace,
  }
  const load = (document: unknown) =>
    loadPersistence({ read: async (section) => (section === 'document' ? document : undefined) })
  assert.deepEqual((await load(record)).workspace, state.workspace)
  const workspace = {
    ...state.workspace,
    maps: [
      {
        ...state.workspace.maps[0],
        relationBends: [{ ...relation, predicate: 'urn:missing', bend: 0.25 }],
      },
    ],
  }
  assert.deepEqual((await load({ ...record, workspace })).blocked, ['document'])
})
