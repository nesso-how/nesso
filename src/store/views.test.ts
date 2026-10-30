import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from './create.ts'
import { buildDeleteViewOperations } from './views.ts'

const fixture = () => ({
  concepts: ['urn:one', 'urn:two', 'urn:three'].map((id) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
  })),
  relationTypes: [{ id: 'urn:links', label: 'links' }],
  relations: [{ source: 'urn:one', predicate: 'urn:links', target: 'urn:two' }],
})

test('view deletion optionally removes shared concepts and memberships as one undoable edit', () => {
  for (const withConcepts of [true, false]) {
    const { store } = createNessoStore(fixture())
    const shared = store.createView('Shared', ['urn:two', 'urn:three'])
    const target = store.createView('Target', ['urn:one', 'urn:two'])
    store.setSelection([{ kind: 'concept', id: 'urn:two' }])
    const before = store.getState()
    let notifications = 0
    store.subscribe(() => notifications++)
    store.applyOperations(buildDeleteViewOperations(before, target, withConcepts))
    const after = store.getState()
    assert.equal(notifications, 1)
    assert.equal(
      after.workspace.savedViews.some((view) => view.id === target),
      false,
    )
    assert.deepEqual(
      after.workspace.savedViews.find((view) => view.id === shared)?.conceptIds,
      withConcepts ? ['urn:three'] : ['urn:two', 'urn:three'],
    )
    assert.deepEqual(
      after.graph.concepts.map((concept) => concept.id),
      withConcepts ? ['urn:three'] : ['urn:one', 'urn:two', 'urn:three'],
    )
    assert.deepEqual(after.graph.relations, withConcepts ? [] : before.graph.relations)
    if (!withConcepts) assert.equal(after.graph, before.graph)
    store.undo()
    assert.deepEqual(store.getState().graph, before.graph)
    assert.deepEqual(store.getState().workspace.savedViews, before.workspace.savedViews)
    store.redo()
    assert.deepEqual(store.getState().graph, after.graph)
    assert.deepEqual(store.getState().workspace.savedViews, after.workspace.savedViews)
  }
})

test('deleting all concepts leaves a fresh disconnected concept and preserves undo for either view scope', () => {
  for (const complete of [true, false]) {
    const { store } = createNessoStore(fixture())
    const shared = store.createView('Shared', ['urn:two'])
    const target = store.createView('Target', ['urn:one', 'urn:two', 'urn:three'])
    store.setSelection([{ kind: 'concept', id: 'urn:two' }])
    const before = store.getState()
    store.applyOperations(buildDeleteViewOperations(before, complete ? null : target, true))
    const after = store.getState()
    assert.equal(after.graph.concepts.length, 1)
    assert.equal(
      before.graph.concepts.some((concept) => concept.id === after.graph.concepts[0].id),
      false,
    )
    assert.deepEqual(after.graph.relations, [])
    assert.deepEqual(after.selected, [])
    assert.equal(after.workspace.activeViewId, null)
    assert.deepEqual(
      after.workspace.savedViews,
      complete
        ? []
        : [{ ...before.workspace.savedViews.find((view) => view.id === shared), conceptIds: [] }],
    )
    store.undo()
    assert.deepEqual(store.getState().graph, before.graph)
    assert.deepEqual(store.getState().workspace.savedViews, before.workspace.savedViews)
    store.redo()
    assert.deepEqual(store.getState().graph, after.graph)
    assert.deepEqual(store.getState().workspace.savedViews, after.workspace.savedViews)
  }
})
