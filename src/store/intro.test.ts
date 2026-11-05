import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from './create.ts'
import { relationKey } from '@nesso-how/schema'
import {
  completeIntro,
  createIntroStore,
  focusConceptId,
  introConnection,
  setIntroStep,
} from './intro.ts'

const vocab = {
  id: 'intro-test',
  defaultTypeId: 'urn:default',
  relationTypes: [
    { id: 'urn:default', label: 'links to' },
    { id: 'urn:causes', label: 'causes' },
  ],
}

const chosenRelation = (store: ReturnType<typeof createIntroStore>) =>
  store
    .getState()
    .graph.relations.find(
      ({ source, target }) =>
        source === introConnection.source && target === introConnection.target,
    )

test('intro steps frame the idea, connection, complete graph and Rest without moving concepts', () => {
  const store = createIntroStore('en', vocab)
  const graph = store.getState().graph
  const seed = createSeedDocument('en')
  assert.deepEqual(store.getState().viewGraph.concepts, [graph.concepts[0]])
  assert.deepEqual(store.getState().viewGraph.relations, [])

  assert.equal(chosenRelation(store), undefined)
  for (const step of [1, 2, 3, 1, 0]) {
    let notifications = 0
    const unsubscribe = store.subscribe(() => {
      notifications++
    })
    setIntroStep(store, step)
    unsubscribe()
    const state = store.getState()
    assert.equal(state.graph.concepts, graph.concepts)
    assert.ok(notifications <= 1)
    const ids =
      step === 0
        ? [introConnection.source]
        : step === 1
          ? [introConnection.source, introConnection.target]
          : step === 3
            ? seed.workspace.savedViews.find(({ id }) => id === 'rest')!.conceptIds
            : graph.concepts.map(({ id }) => id)
    assert.deepEqual(
      state.viewGraph.concepts.map(({ id }) => id),
      ids,
    )
    if (step >= 2) assert.deepEqual(state.workspace.savedViews, seed.workspace.savedViews)
    assert.deepEqual(
      state.selected,
      step === 0 || (step === 1 && !chosenRelation(store))
        ? [{ kind: 'concept', id: introConnection.source }]
        : step === 1
          ? [{ kind: 'relation', id: relationKey(chosenRelation(store)!) }]
          : [],
    )
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
  const intro = createIntroStore('it', vocab)
  for (const step of [1, 2, 3, 0]) setIntroStep(intro, step)
  setIntroStep(intro, 1)
  intro.createRelationType(relationKey(chosenRelation(intro)!), 'My relation')
  intro.setView('energy')
  assert.equal(intro.getState().workspace.activeViewId, 'energy')
  assert.ok(intro.getState().viewGraph.concepts.length < intro.getState().graph.concepts.length)
  setIntroStep(intro, 2)
  assert.equal(intro.getState().workspace.activeViewId, null)
  assert.deepEqual(intro.getState().viewGraph.concepts, seed.graph.concepts)
  assert.equal(host.store.getState(), original)
  assert.equal(intro.getState().preferences.locale, 'it')
  assert.equal(intro.getState().pluginStorage.length, 0)
  assert.deepEqual(intro.getState().graph.concepts, seed.graph.concepts)
})

test('connecting selects an unnamed relation and preserves a chosen or custom type across steps', () => {
  for (const custom of [false, true]) {
    const store = createIntroStore('en', vocab)
    setIntroStep(store, 1)
    store.connect(introConnection.source, introConnection.target)
    const relation = chosenRelation(store)!
    assert.equal(relation.predicate, vocab.defaultTypeId)
    assert.deepEqual(store.getState().selected, [{ kind: 'relation', id: relationKey(relation) }])
    if (custom) store.createRelationType(relationKey(relation), 'keeps me awake')
    else store.setRelationType(relationKey(relation), 'urn:causes')
    const choice = chosenRelation(store)!
    for (const step of [2, 3, 0, 1]) {
      setIntroStep(store, step)
      assert.deepEqual(chosenRelation(store), choice)
    }
    assert.equal(store.getState().graph.relations.length, 4)
  }
})

test('skipping or clearing a relation restores its localized seed type, even after renaming it', () => {
  const seed = createSeedDocument('it')
  const expected = seed.graph.relationTypes.find(({ id }) => id === 'urn:nesso:example:disrupts')!
  for (const connect of [false, true]) {
    const store = createIntroStore('it', vocab)
    setIntroStep(store, 1)
    if (connect) store.connect(introConnection.source, introConnection.target)
    for (const rename of [false, true]) {
      if (rename) {
        setIntroStep(store, 1)
        store.createRelationType(relationKey(chosenRelation(store)!), 'My relation')
        store.setRelationType(relationKey(chosenRelation(store)!), vocab.defaultTypeId)
      }
      setIntroStep(store, 2)
      assert.equal(chosenRelation(store)!.predicate, expected.id)
      assert.deepEqual(
        store.getState().graph.relationTypes.find(({ id }) => id === expected.id),
        expected,
      )
      assert.equal(store.getState().graph.relations.length, seed.graph.relations.length)
    }
  }
})

test('completing the intro selects seed Focus once, then preserves selection', () => {
  const seed = createSeedDocument('en')
  const { store } = createNessoStore(seed.graph, { workspace: seed.workspace })
  const original = store.getState()
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications++
  })
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

test('compact intro starts with the complete localized graph and named relations', () => {
  const store = createIntroStore('it', vocab, 2)
  const seed = createSeedDocument('it')
  const state = store.getState()
  assert.equal(state.workspace.activeViewId, null)
  assert.deepEqual(state.viewGraph.concepts, seed.graph.concepts)
  assert.equal(state.viewGraph.relations.length, seed.graph.relations.length)
  assert.deepEqual(
    chosenRelation(store),
    seed.graph.relations.find(
      ({ source, target }) =>
        source === introConnection.source && target === introConnection.target,
    ),
  )
  assert.deepEqual(state.selected, [])
  assert.deepEqual(state.workspace.savedViews, seed.workspace.savedViews)
})

test('completing the compact intro clears selection atomically without changing the document', () => {
  const seed = createSeedDocument('en')
  const { store } = createNessoStore(seed.graph, { workspace: seed.workspace })
  store.setSelection([{ kind: 'concept', id: focusConceptId }])
  const before = store.getState()
  let notifications = 0
  const unsubscribe = store.subscribe(() => notifications++)
  completeIntro(store, false)
  unsubscribe()
  const after = store.getState()
  assert.equal(notifications, 1)
  assert.equal(after.preferences.introSeen, true)
  assert.deepEqual(after.selected, [])
  assert.equal(after.graph, before.graph)
  assert.equal(after.workspace, before.workspace)
  assert.equal(after.history, before.history)
  completeIntro(store, false)
  assert.equal(store.getState(), after)
})
