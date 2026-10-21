import assert from 'node:assert/strict'
import test from 'node:test'
import { relationKey, type Graph } from '@nesso/schema'
import { createNessoStore } from './create.ts'
import { copyGraph, pasteOperations } from '../../packages/concept-map/src/clipboard.ts'
import { buildImportOperations } from '../../plugins/import/src/index.ts'

const fixture = (): Graph => ({
  concepts: [
    { id: 'urn:n1', label: 'One', position: { x: 0, y: 0 } },
    { id: 'urn:n2', label: 'Two', position: { x: 1, y: 0 } },
    { id: 'urn:n3', label: 'Three', position: { x: 2, y: 0 } },
  ],
  relationTypes: [{ id: 'urn:links', label: 'links' }],
  relations: [
    { source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' },
    { source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' },
  ],
})

test('paste uses one atomic undoable batch, preserves parallel types, and joins the active view without implicit links', () => {
  const { store } = createNessoStore(fixture())
  store.createView('Active', ['urn:n1'])
  store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
  const before = store.getState()
  const copied = fixture()
  copied.concepts[0].description = 'Definition\nExample'
  copied.relationTypes.push({ id: 'urn:custom', label: 'Custom' })
  copied.relations.push({ ...copied.relations[0], predicate: 'urn:custom' })
  const text = copyGraph(copied, [{ kind: 'concept', id: 'urn:n1' }, { kind: 'concept', id: 'urn:n2' }])!
  let notifications = 0
  store.subscribe(() => notifications++)
  store.applyOperations(pasteOperations(text))
  const after = store.getState()
  const copies = after.graph.concepts.slice(3)
  const relations = after.graph.relations.slice(2)
  assert.equal(copies[0].description, copied.concepts[0].description)
  assert.equal(Object.hasOwn(copies[1], 'description'), false)
  assert.equal(notifications, 1)
  assert.deepEqual(copies.map((concept) => ({ label: concept.label, position: concept.position })), [
    { label: 'One', position: { x: 40, y: 40 } }, { label: 'Two', position: { x: 41, y: 40 } },
  ])
  assert.deepEqual(relations, copied.relations.filter((relation) => relation.target === 'urn:n2')
    .map((relation) => ({ ...relation, source: copies[0].id, target: copies[1].id })))
  assert.deepEqual(after.graph.relationTypes, copied.relationTypes)
  assert.deepEqual(after.viewGraph.concepts.map((concept) => concept.id), ['urn:n1', ...copies.map((concept) => concept.id)])
  assert.deepEqual(after.selected, [
    ...copies.map((concept) => ({ kind: 'concept', id: concept.id })),
    ...relations.map((relation) => ({ kind: 'relation', id: relationKey(relation) })),
  ])
  store.undo()
  assert.deepEqual(store.getState().graph, before.graph)
  assert.deepEqual(store.getState().workspace.savedViews, before.workspace.savedViews)
})

test('import preserves disconnected concepts and parallel relations in either order as one undoable edit', () => {
  for (const predicates of [[], ['urn:links', 'urn:custom'], ['urn:custom', 'urn:links']]) {
    const host = createNessoStore(fixture())
    host.registerVocab({
      id: 'a',
      relationTypes: [
        { id: 'urn:links', label: 'links' },
        { id: 'urn:part', label: 'part' },
        { id: 'urn:ext', label: 'external' },
      ],
      defaultTypeId: 'urn:links',
    })
    const store = host.store
    const viewId = host.store.createView('Target', ['urn:n1'])
    store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
    const before = store.getState()
    const snapshot: Graph = {
      concepts: fixture().concepts.slice(0, 2),
      relationTypes: [{ id: 'urn:links', label: 'links' }, { id: 'urn:custom', label: 'Custom' }],
      relations: predicates.map((predicate) => ({ source: 'urn:n1', predicate, target: 'urn:n2' })),
    }
    store.applyOperations(buildImportOperations(snapshot, before.workspace.activeViewId, viewId))
    const after = store.getState()
    const copies = after.graph.concepts.slice(before.graph.concepts.length)
    assert.deepEqual(copies.map((concept) => concept.label), snapshot.concepts.map((concept) => concept.label))
    assert.deepEqual(after.graph.relations.slice(before.graph.relations.length), snapshot.relations.map((relation) => ({
      ...relation, source: copies[0].id, target: copies[1].id,
    })))
    assert.deepEqual(after.viewGraph.concepts.map((concept) => concept.id), ['urn:n1', ...copies.map((concept) => concept.id)])
    host.store.undo()
    assert.deepEqual(host.store.getState().graph, before.graph)
    assert.deepEqual(host.store.getState().workspace, before.workspace)
  }
})
