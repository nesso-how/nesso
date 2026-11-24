import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from './create.ts'
import { buildDeleteMapOperations, exclusiveConceptIds, revealConceptOperations } from './maps.ts'

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

test('hidden groups filter the graph view without touching the document or history', () => {
  const { store } = createNessoStore({
    ...fixture(),
    relations: [
      { source: 'urn:one', predicate: 'urn:links', target: 'urn:two' },
      { source: 'urn:two', predicate: 'urn:links', target: 'urn:three' },
    ],
  })
  store.applyOperations([
    { kind: 'map-group.create', id: 'urn:group', name: 'Group' },
    { kind: 'map.create', id: 'urn:grouped', name: 'Grouped', conceptIds: ['urn:one', 'urn:two'] },
    { kind: 'map.group', id: 'urn:grouped', groupId: 'urn:group' },
    { kind: 'map.create', id: 'urn:loose', name: 'Loose', conceptIds: ['urn:two'] },
    { kind: 'map.activate', id: null },
  ])
  store.setSelection([
    { kind: 'concept', id: 'urn:one' },
    { kind: 'concept', id: 'urn:two' },
  ])
  const before = store.getState()
  const visible = () => store.getState().mapGraph.concepts.map(({ id }) => id)
  store.applyOperations([{ kind: 'map-group.setVisible', id: 'urn:group', visible: false }])
  let state = store.getState()
  assert.deepEqual(visible(), ['urn:two', 'urn:three'])
  assert.deepEqual(state.mapGraph.relations, [before.graph.relations[1]])
  assert.deepEqual(state.selected, [{ kind: 'concept', id: 'urn:two' }])
  assert.equal(state.graph, before.graph)
  assert.equal(state.workspace, before.workspace)
  assert.equal(state.history, before.history)
  store.renameMap('urn:loose', 'Renamed')
  assert.equal(store.getState().mapGraph, state.mapGraph)
  store.applyOperations([{ kind: 'map-group.setVisible', id: null, visible: false }])
  assert.deepEqual(visible(), ['urn:three'])
  assert.deepEqual(revealConceptOperations(store.getState(), 'urn:two'), [
    { kind: 'map-group.setVisible', id: 'urn:group', visible: true },
    { kind: 'map-group.setVisible', id: null, visible: true },
  ])
  assert.deepEqual(revealConceptOperations(store.getState(), 'urn:three'), [])
  store.setMap('urn:grouped')
  assert.deepEqual(visible(), ['urn:one', 'urn:two'])
  store.setMap(null)
  store.applyOperations([{ kind: 'map-group.remove', id: 'urn:group' }])
  state = store.getState()
  assert.deepEqual(state.hiddenMapGroupIds, [null])
  assert.deepEqual(visible(), ['urn:three'])
  store.undo()
  store.applyOperations([{ kind: 'map-group.setVisible', id: 'urn:group', visible: false }])
  store.redo()
  assert.deepEqual(store.getState().hiddenMapGroupIds, [null])
  store.undo()
  state = store.getState()
  assert.deepEqual(state.hiddenMapGroupIds, [null])
  store.applyOperations([
    { kind: 'map-group.setVisible', id: 'urn:group', visible: false },
    { kind: 'map-group.setVisible', id: 'urn:group', visible: true },
  ])
  assert.equal(store.getState(), state)
  store.applyOperations([
    { kind: 'document.reset', id: 'urn:document' },
    { kind: 'map-group.setVisible', id: null, visible: false },
  ])
  assert.deepEqual(store.getState().hiddenMapGroupIds, [null])
})

test('hidden maps and unmapped concepts filter the graph view', () => {
  const { store } = createNessoStore(fixture())
  store.applyOperations([
    { kind: 'map-group.create', id: 'urn:group', name: 'Group' },
    { kind: 'map.create', id: 'urn:grouped', name: 'Grouped', conceptIds: ['urn:one', 'urn:two'] },
    { kind: 'map.group', id: 'urn:grouped', groupId: 'urn:group' },
    { kind: 'map.create', id: 'urn:loose', name: 'Loose', conceptIds: ['urn:two'] },
    { kind: 'map.activate', id: null },
  ])
  const { graph, history } = store.getState()
  const visible = () => store.getState().mapGraph.concepts.map(({ id }) => id)
  const hide = (id: string | null) =>
    store.applyOperations([{ kind: 'map.setVisible', id, visible: false }])
  hide(null)
  assert.deepEqual(visible(), ['urn:one', 'urn:two'])
  assert.equal(store.getState().mapGraph.relations, graph.relations)
  assert.equal(store.getState().history, history)
  assert.deepEqual(revealConceptOperations(store.getState(), 'urn:three'), [
    { kind: 'map.setVisible', id: null, visible: true },
  ])
  hide('urn:grouped')
  store.applyOperations([{ kind: 'map-group.setVisible', id: 'urn:group', visible: false }])
  assert.deepEqual(revealConceptOperations(store.getState(), 'urn:one'), [
    { kind: 'map-group.setVisible', id: 'urn:group', visible: true },
    { kind: 'map.setVisible', id: 'urn:grouped', visible: true },
  ])
  store.applyOperations([{ kind: 'map-group.setVisible', id: 'urn:group', visible: true }])
  assert.deepEqual(visible(), ['urn:two'])
  store.applyOperations([{ kind: 'map.remove', id: 'urn:grouped' }])
  assert.deepEqual(store.getState().hiddenMapIds, [null])
  store.undo()
  assert.deepEqual(visible(), ['urn:one', 'urn:two'])
  hide('urn:loose')
  store.undo()
  assert.deepEqual(store.getState().hiddenMapIds, [null])
  store.applyOperations([{ kind: 'document.reset', id: 'urn:document' }])
  assert.deepEqual(store.getState().hiddenMapIds, [])
})
