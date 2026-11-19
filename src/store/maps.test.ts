import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from './create.ts'
import { buildDeleteMapOperations, exclusiveConceptIds } from './maps.ts'

const fixture = () => ({
  concepts: ['urn:one', 'urn:two', 'urn:three'].map((id) => ({
    id,
    label: id,
  })),
  relationTypes: [{ id: 'urn:links', label: 'links' }],
  relations: [{ source: 'urn:one', predicate: 'urn:links', target: 'urn:two' }],
})

test('map deletion removes concepts exclusive to the map unless kept, as one undoable edit', () => {
  for (const keepConcepts of [false, true]) {
    const { store } = createNessoStore(fixture())
    const shared = store.createMap('Shared', ['urn:two'])
    const target = store.createMap('Target', ['urn:one', 'urn:two'])
    store.setSelection([{ kind: 'concept', id: 'urn:two' }])
    const before = store.getState()
    assert.deepEqual([...exclusiveConceptIds(before, target)], ['urn:one'])
    let notifications = 0
    store.subscribe(() => notifications++)
    store.applyOperations(buildDeleteMapOperations(before, target, keepConcepts))
    const after = store.getState()
    assert.equal(notifications, 1)
    assert.deepEqual(
      after.workspace.maps.map((map) => map.id),
      [shared],
    )
    assert.deepEqual(
      after.workspace.maps[0].members.map(({ id }) => id),
      ['urn:two'],
    )
    if (keepConcepts) assert.equal(after.graph, before.graph)
    else {
      assert.deepEqual(
        after.graph.concepts.map((concept) => concept.id),
        ['urn:two', 'urn:three'],
      )
      assert.deepEqual(after.graph.relations, [])
    }
    store.undo()
    assert.deepEqual(store.getState().graph, before.graph)
    assert.deepEqual(store.getState().workspace.maps, before.workspace.maps)
    store.redo()
    assert.deepEqual(store.getState().graph, after.graph)
    assert.deepEqual(store.getState().workspace.maps, after.workspace.maps)
  }
})

test('deleting all concepts leaves a fresh disconnected concept and preserves undo for either map scope', () => {
  for (const complete of [true, false]) {
    const { store } = createNessoStore(fixture())
    const shared = store.createMap('Shared', complete ? ['urn:two'] : [])
    const target = store.createMap('Target', ['urn:one', 'urn:two', 'urn:three'])
    store.setSelection([{ kind: 'concept', id: 'urn:two' }])
    const before = store.getState()
    store.applyOperations(buildDeleteMapOperations(before, complete ? null : target))
    const after = store.getState()
    assert.equal(after.graph.concepts.length, 1)
    assert.equal(
      before.graph.concepts.some((concept) => concept.id === after.graph.concepts[0].id),
      false,
    )
    assert.deepEqual(after.graph.relations, [])
    assert.deepEqual(after.selected, [])
    const [{ id, ...remaining }, ...rest] = after.workspace.maps
    assert.deepEqual(rest, [])
    assert.equal(after.workspace.activeMapId, id)
    if (!complete) assert.equal(id, shared)
    assert.deepEqual(remaining, {
      name: complete ? 'Map 1' : 'Shared',
      pinned: false,
      members: [{ id: after.graph.concepts[0].id, position: { x: 0, y: 0 } }],
    })
    store.undo()
    assert.deepEqual(store.getState().graph, before.graph)
    assert.deepEqual(store.getState().workspace.maps, before.workspace.maps)
    store.redo()
    assert.deepEqual(store.getState().graph, after.graph)
    assert.deepEqual(store.getState().workspace.maps, after.workspace.maps)
  }
})
