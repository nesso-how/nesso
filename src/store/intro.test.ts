import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from './create.ts'
import { completeIntro, createIntroStore, focusConceptId, setIntroStep } from './intro.ts'

test('intro steps reuse one graph and restore the seed views when moving forward and back', () => {
  const store = createIntroStore('en')
  const graph = store.getState().graph
  const seed = createSeedDocument('en')
  assert.deepEqual(store.getState().viewGraph.concepts, [graph.concepts[0]])
  assert.deepEqual(store.getState().viewGraph.relations, [])

  for (const step of [1, 2, 1, 0, 1]) {
    let notifications = 0
    const unsubscribe = store.subscribe(() => { notifications++ })
    setIntroStep(store, step)
    unsubscribe()
    const state = store.getState()
    assert.equal(state.graph, graph)
    assert.ok(notifications <= 1)
    assert.deepEqual(state.viewGraph.concepts, step === 0 ? [graph.concepts[0]] : graph.concepts)
    if (step > 0) assert.deepEqual(state.workspace.savedViews, seed.workspace.savedViews)
    assert.deepEqual(state.selected, step === 0 || step === 2 ? [{ kind: 'concept', id: graph.concepts[step === 0 ? 0 : 3].id }] : [])
  }
})

test('intro navigation stays isolated from the user document and its viewport', () => {
  const seed = createSeedDocument('it')
  const host = createNessoStore(seed.graph, { workspace: seed.workspace })
  host.registerRenderer({ id: 'concept-map' })
  host.store.setConceptLabel(seed.graph.concepts[0].id, 'My concept')
  host.store.setView('rest')
  host.store.setSelection([{ kind: 'concept', id: seed.graph.concepts[0].id }])
  host.store.setViewport('concept-map', { x: 100, y: 200, zoom: 0.8 })
  const original = host.store.getState()
  const intro = createIntroStore('it')
  for (const step of [1, 2, 0]) setIntroStep(intro, step)
  setIntroStep(intro, 1)
  intro.setView('energy')
  assert.equal(intro.getState().workspace.activeViewId, 'energy')
  assert.ok(intro.getState().viewGraph.concepts.length < intro.getState().graph.concepts.length)
  setIntroStep(intro, 2)
  assert.equal(intro.getState().workspace.activeViewId, null)
  assert.deepEqual(intro.getState().viewGraph.concepts, seed.graph.concepts)
  intro.setSelection([{ kind: 'concept', id: seed.graph.concepts[0].id }])
  assert.deepEqual(intro.getState().selected, [{ kind: 'concept', id: seed.graph.concepts[0].id }])
  intro.applyOperations([{ kind: 'preferences.inspectorTab', value: 'chat' }])
  assert.equal(intro.getState().preferences.inspectorTab, 'chat')
  assert.equal(host.store.getState(), original)
  assert.equal(intro.getState().preferences.locale, 'it')
  assert.deepEqual(intro.getState().graph, seed.graph)
})

test('completing the intro selects seed Focus once, then preserves selection', () => {
  const seed = createSeedDocument('en')
  const { store } = createNessoStore(seed.graph, { workspace: seed.workspace })
  const original = store.getState()
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications++ })
  completeIntro(store)
  unsubscribe()
  assert.equal(notifications, 1)
  assert.equal(store.getState().preferences.introSeen, true)
  assert.deepEqual(store.getState().selected, [{ kind: 'concept', id: focusConceptId }])
  assert.equal(store.getState().graph, original.graph)
  assert.equal(store.getState().workspace, original.workspace)
  assert.equal(store.getState().history, original.history)

  const replayed = store.getState()
  completeIntro(store)
  assert.equal(store.getState(), replayed)

  const fresh = createNessoStore(null)
  fresh.store.setSelection([{ kind: 'concept', id: fresh.store.getState().graph.concepts[0].id }])
  const before = fresh.store.getState()
  completeIntro(fresh.store)
  assert.equal(fresh.store.getState().preferences.introSeen, true)
  assert.equal(fresh.store.getState().selected, before.selected)
  assert.equal(fresh.store.getState().graph, before.graph)
})
