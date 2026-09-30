import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoStore, VocabDefinition } from '@nesso/plugin'
import { relationKey, SchemaError, validateGraph, type Graph } from '@nesso/schema'
import { createNessoStore } from './create.ts'

const fixture = (): Graph => ({
  concepts: [
    { id: 'urn:n1', label: 'One', tags: [], position: { x: 0, y: 0 } },
    { id: 'urn:n2', label: 'Two', tags: [], position: { x: 1, y: 0 } },
    { id: 'urn:n3', label: 'Three', tags: [], position: { x: 2, y: 0 } },
  ],
  relationTypes: [{ id: 'urn:links', label: 'links' }],
  relations: [
    { source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' },
    { source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' },
  ],
})

const vocabA: VocabDefinition = {
  id: 'a',
  label: 'A',
  relationTypes: [
    { id: 'urn:links', label: 'links' },
    { id: 'urn:part', label: 'part' },
    { id: 'urn:ext', label: 'external' },
  ],
  defaultTypeId: 'urn:links',
}

const vocabB: VocabDefinition = {
  id: 'b',
  label: 'B',
  relationTypes: [{ id: 'urn:ext', label: 'ext' }],
  defaultTypeId: 'urn:ext',
}

const issuesOf = (run: () => void): SchemaError['issues'] => {
  try {
    run()
  } catch (error) {
    if (error instanceof SchemaError) return error.issues
    throw error
  }
  assert.fail('Expected SchemaError')
}

test('an invalid edit is rejected atomically and leaves document, focus and selection untouched', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setFocus('urn:n2')
  host.store.setSelection({ kind: 'relation', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' }) })
  const before = host.store.getState().graph
  const issues = issuesOf(() => host.store.editGraph((draft) => {
    draft.concepts[0].label = 'Mutated'
    draft.relations.push({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:missing' })
    return draft
  }))
  assert.ok(issues.some(({ path, message }) => path === 'relations[2]' && message.includes('urn:missing')))
  assert.equal(host.store.getState().graph, before)
  assert.equal(host.store.getState().focusId, 'urn:n2')
  assert.deepEqual(host.store.getState().selected, { kind: 'relation', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' }) })
  host.store.setConceptLabel('urn:n1', 'Renamed')
  assert.equal(host.store.getState().graph.concepts[0].label, 'Renamed')
})

test('deleting a concept prunes incident relations, reconciles focus and selection, and keeps one concept', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setFocus('urn:n2')
  host.store.setSelection({ kind: 'relation', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' }) })
  host.store.removeConcept('urn:n1')
  const state = host.store.getState()
  assert.equal(state.focusId, 'urn:n2')
  assert.deepEqual(state.graph.relations, [])
  assert.equal(state.selected, null)
  host.store.removeConcept('urn:n3')
  assert.match(issuesOf(() => host.store.removeConcept('urn:n2')).map(({ message }) => message).join(' '), /at least one concept/)
  assert.equal(host.store.getState().graph.concepts.length, 1)
  host.store.setSelection({ kind: 'relation', id: relationKey({ source: 'urn:n2', predicate: 'urn:links', target: 'urn:n1' }) })
  assert.equal(host.store.getState().selected, null)
  host.store.setSelection({ kind: 'concept', id: 'urn:n2' })
  assert.deepEqual(host.store.getState().selected, { kind: 'concept', id: 'urn:n2' })
})

test('retyping a relation moves its identity and selection to the new triple and adds the type atomically', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  const id = relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' })
  host.store.setSelection({ kind: 'relation', id })
  host.store.setRelationType(id, 'urn:part')
  const state = host.store.getState()
  const retyped = { source: 'urn:n1', predicate: 'urn:part', target: 'urn:n2' }
  assert.deepEqual(state.graph.relations[0], retyped)
  assert.deepEqual(state.selected, { kind: 'relation', id: relationKey(retyped) })
  assert.deepEqual(state.graph.relationTypes.find(({ id: typeId }) => typeId === 'urn:part'), { id: 'urn:part', label: 'part' })
  host.store.connect('urn:n1', 'urn:n2')
  assert.deepEqual(host.store.getState().graph.relations.at(-1), { source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' })
  host.store.connect('urn:n1', 'urn:n2')
  assert.equal(host.store.getState().graph.relations.length, 3)
})

test('vocab registration validates, switching never rewrites the document, and using a new default adds its type', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  assert.match(issuesOf(() => host.registerVocab(vocabA)).map(({ path, message }) => `${path} ${message}`).join(' '), /^id /)
  assert.match(
    issuesOf(() => host.registerVocab({ id: 'bad', label: 'Bad', relationTypes: [], defaultTypeId: 'urn:ext' })).map(({ path }) => path).join(' '),
    /^defaultTypeId$/,
  )
  assert.match(issuesOf(() => host.registerVocab({
    id: 'dup',
    label: 'Dup',
    relationTypes: [{ id: 'urn:links', label: 'links' }, { id: 'urn:links', label: 'again' }],
    defaultTypeId: 'urn:links',
  })).map(({ path }) => path).join(' '), /relationTypes\[1\]\.id/)
  assert.match(issuesOf(() => host.registerVocab({
    id: 'empty',
    label: 'Empty',
    relationTypes: [{ id: '', label: 'none' }],
    defaultTypeId: '',
  })).map(({ path }) => path).join(' '), /^relationTypes\[0\]\.id defaultTypeId$/)
  assert.match(issuesOf(() => host.store.setActiveVocab('nope')).map(({ message }) => message).join(' '), /Unknown vocabulary/)
  assert.equal(host.store.getState().vocabs.length, 1)
  const document = host.store.getState().graph
  host.registerVocab(vocabB)
  host.store.setActiveVocab('b')
  assert.equal(host.store.getState().activeVocabId, 'b')
  assert.equal(host.store.getState().graph, document)
  const added = host.store.addConcept()
  const state = host.store.getState()
  assert.deepEqual(state.graph.relations.at(-1), { source: 'urn:n1', predicate: 'urn:ext', target: added })
  assert.deepEqual(state.graph.relationTypes.at(-1), { id: 'urn:ext', label: 'ext' })
  assert.ok(state.graph.relationTypes.some(({ id: typeId }) => typeId === 'urn:links'))
})

test('the view graph materializes the focus neighborhood and follows the view mode', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  let state = host.store.getState()
  assert.equal(state.view, 'focus')
  assert.deepEqual(state.viewGraph.concepts.map((concept) => concept.id), ['urn:n1', 'urn:n2', 'urn:n3'])
  const added = host.store.addConcept()
  assert.ok(host.store.getState().viewGraph.concepts.some((concept) => concept.id === added))
  host.store.setView('whole')
  state = host.store.getState()
  assert.equal(state.viewGraph, state.graph)
  host.store.setFocus('urn:n2')
  state = host.store.getState()
  assert.equal(state.view, 'focus')
  assert.deepEqual(state.viewGraph.concepts.map((concept) => concept.id), ['urn:n1', 'urn:n2'])
  assert.deepEqual(state.viewGraph.relations, [{ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' }])
  assert.deepEqual(state.viewGraph.relationTypes, [{ id: 'urn:links', label: 'links' }])
})

test('renderer registration rejects duplicate ids and unknown activation, first one becomes active', () => {
  const host = createNessoStore(fixture())
  const renderer = { id: 'graph', label: 'Graph', component: () => null }
  host.registerRenderer(renderer)
  assert.equal(host.store.getState().activeRendererId, 'graph')
  const issues = issuesOf(() => host.registerRenderer({ ...renderer, label: 'Other' }))
  assert.deepEqual(issues, [{ path: 'renderer.id', message: 'Duplicate renderer id: graph' }])
  assert.match(issuesOf(() => host.store.setActiveRenderer('other')).map(({ message }) => message).join(' '), /Unknown renderer/)
  assert.equal(host.getRenderer('graph'), renderer)
  assert.deepEqual(host.listRenderers(), [renderer])
})

test('initialization validates and owns a private copy of the graph', () => {
  assert.throws(
    () => createNessoStore({ concepts: [], relationTypes: [], relations: [] }),
    (error: unknown) => error instanceof SchemaError,
  )
  const input = fixture()
  const host = createNessoStore(input)
  input.concepts.pop()
  input.relations.push({ source: 'urn:n2', predicate: 'urn:links', target: 'urn:n3' })
  assert.equal(host.store.getState().graph.concepts.length, 3)
  assert.equal(host.store.getState().graph.relations.length, 2)
})

test('relation types are selected by IRI even when document and vocabulary labels collide', () => {
  const host = createNessoStore(fixture())
  host.registerVocab({
    id: 'collision',
    label: 'Collision',
    relationTypes: [{ id: 'urn:other-links', label: 'links' }],
    defaultTypeId: 'urn:other-links',
  })
  const before = host.store.getState()
  const id = relationKey(before.graph.relations[0])
  host.store.setRelationType(id, 'urn:links')
  assert.equal(host.store.getState(), before)
  host.store.setRelationType(id, 'urn:other-links')
  const state = host.store.getState()
  assert.equal(state.graph.relations[0].predicate, 'urn:other-links')
  assert.deepEqual(state.selected, { kind: 'relation', id: relationKey(state.graph.relations[0]) })
  assert.deepEqual(state.graph.relationTypes, [
    { id: 'urn:links', label: 'links' },
    { id: 'urn:other-links', label: 'links' },
  ])
})

test('unknown type IRIs are rejected atomically and retyping never creates duplicate triples', () => {
  const graph = fixture()
  graph.relationTypes.push({ id: 'urn:part', label: 'part' })
  graph.relations.push({ source: 'urn:n1', predicate: 'urn:part', target: 'urn:n2' })
  const host = createNessoStore(graph)
  host.registerVocab(vocabA)
  const before = host.store.getState()
  const id = relationKey(before.graph.relations[0])
  assert.deepEqual(issuesOf(() => host.store.setRelationType(id, 'urn:unknown')), [
    { path: 'relationTypeId', message: 'Unknown relation type: urn:unknown' },
  ])
  assert.equal(host.store.getState(), before)
  host.store.setRelationType(id, 'urn:part')
  assert.equal(host.store.getState(), before)
})

test('naming a new relation type creates and assigns its own IRI atomically', () => {
  const host = createNessoStore(fixture())
  const before = host.store.getState()
  const id = relationKey(before.graph.relations[0])
  assert.deepEqual(issuesOf(() => host.store.createRelationType(id, '  ')), [
    { path: 'label', message: 'Relation type label must not be empty' },
  ])
  assert.equal(host.store.getState(), before)
  host.store.createRelationType(id, ' links ')
  const state = host.store.getState()
  const type = state.graph.relationTypes.at(-1)
  assert.equal(type?.label, 'links')
  assert.notEqual(type?.id, 'urn:links')
  assert.equal(state.graph.relations[0].predicate, type?.id)
  assert.deepEqual(state.selected, { kind: 'relation', id: relationKey(state.graph.relations[0]) })
  assert.deepEqual(validateGraph(structuredClone(state.graph) as Graph), [])
})

test('editGraph owns its result even when callers retain the draft or return an external graph', () => {
  for (const replace of [false, true]) {
    const host = createNessoStore(fixture())
    host.store.setFocus('urn:n2')
    const external = fixture()
    const retained: Graph[] = []
    host.store.editGraph((draft) => {
      retained.push(draft)
      return replace ? external : draft
    })
    const before = host.store.getState()
    const snapshot = structuredClone(before)
    let notifications = 0
    host.store.subscribe(() => notifications++)
    retained[0].concepts[0].position.x = NaN
    retained[0].concepts.pop()
    external.concepts[0].position.x = NaN
    external.concepts.pop()
    assert.equal(host.store.getState(), before)
    assert.deepEqual(host.store.getState(), snapshot)
    assert.equal(notifications, 0)
    assert.deepEqual(validateGraph(structuredClone(before.graph) as Graph), [])
  }
})

test('concept positions and selection are copied from their callers', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  const position = { x: 10, y: 20 }
  const id = host.store.addConcept(position)
  const selection = { kind: 'concept' as const, id }
  host.store.setSelection(selection)
  position.x = NaN
  selection.id = 'urn:missing'
  assert.deepEqual(host.store.getState().graph.concepts.find((concept) => concept.id === id)?.position, { x: 10, y: 20 })
  assert.deepEqual(host.store.getState().selected, { kind: 'concept', id })
  assert.deepEqual(validateGraph(structuredClone(host.store.getState().graph) as Graph), [])
})

test('registered vocabularies and their inserted types are owned independently by each store', () => {
  const input = {
    id: 'shared',
    label: 'Shared',
    relationTypes: [{ id: 'urn:shared-type', label: 'shared' }],
    defaultTypeId: 'urn:shared-type',
  }
  const a = createNessoStore(fixture())
  const b = createNessoStore(fixture())
  a.registerVocab(input)
  b.registerVocab(input)
  input.id = 'changed'
  input.defaultTypeId = 'urn:changed'
  input.relationTypes[0].id = 'urn:changed'
  input.relationTypes[0].label = 'changed'
  for (const host of [a, b]) {
    host.store.addConcept()
    const state = host.store.getState()
    assert.equal(state.activeVocabId, 'shared')
    assert.equal(state.vocabs[0].defaultTypeId, 'urn:shared-type')
    assert.deepEqual(state.graph.relationTypes.at(-1), { id: 'urn:shared-type', label: 'shared' })
    assert.notEqual(state.graph.relationTypes.at(-1), state.vocabs[0].relationTypes[0])
    assert.deepEqual(validateGraph(structuredClone(state.graph) as Graph), [])
  }
  assert.notEqual(a.store.getState().vocabs[0], b.store.getState().vocabs[0])
  assert.notEqual(a.store.getState().vocabs[0].relationTypes[0], b.store.getState().vocabs[0].relationTypes[0])
  assert.notEqual(a.store.getState().graph.relationTypes.at(-1), b.store.getState().graph.relationTypes.at(-1))
})

test('a position batch publishes once and shares untouched graph objects', () => {
  for (const view of ['focus', 'whole'] as const) {
    const graph = fixture()
    graph.relations.pop()
    const { store } = createNessoStore(graph)
    store.setView(view)
    const before = store.getState()
    const snapshot = structuredClone(before)
    const updates = [
      { id: 'urn:n1', position: { x: 10, y: 20 } },
      { id: 'urn:n2', position: { x: 30, y: 40 } },
    ]
    let notifications = 0
    store.subscribe(() => notifications++)
    store.setConceptPositions(updates)
    const after = store.getState()
    assert.equal(notifications, 1)
    assert.deepEqual(after.graph.concepts.map(({ position }) => position), [
      { x: 10, y: 20 }, { x: 30, y: 40 }, { x: 2, y: 0 },
    ])
    for (const index of [0, 1]) {
      assert.notEqual(after.graph.concepts[index], before.graph.concepts[index])
      assert.equal(after.graph.concepts[index].tags, before.graph.concepts[index].tags)
      assert.equal(after.viewGraph.concepts[index], after.graph.concepts[index])
    }
    assert.equal(after.graph.concepts[2], before.graph.concepts[2])
    assert.equal(after.graph.relations, before.graph.relations)
    assert.equal(after.graph.relationTypes, before.graph.relationTypes)
    if (view === 'whole') assert.equal(after.viewGraph, after.graph)
    else assert.deepEqual(after.viewGraph.concepts.map(({ id }) => id), ['urn:n1', 'urn:n2'])
    assert.deepEqual(before, snapshot)
    updates[0].position.x = NaN
    assert.deepEqual(after.graph.concepts[0].position, { x: 10, y: 20 })
  }
})

test('position batches reject invalid coordinates atomically in every view mode', () => {
  for (const view of ['focus', 'whole'] as const) {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const { store } = createNessoStore(fixture())
      store.setFocus('urn:n2')
      store.setView(view)
      const before = store.getState()
      let notifications = 0
      store.subscribe(() => notifications++)
      assert.deepEqual(issuesOf(() => store.setConceptPositions([
        { id: 'urn:n1', position: { x: 10, y: 20 } },
        { id: 'urn:n3', position: { x: 30, y: invalid } },
      ])), [{ path: 'concepts[2].position', message: 'Invalid position: urn:n3' }])
      assert.equal(store.getState(), before)
      assert.equal(notifications, 0)
    }
  }
})

test('position batches ignore unknown ids and use the last position for repeated ids', () => {
  const { store } = createNessoStore(fixture())
  let notifications = 0
  store.subscribe(() => notifications++)
  store.setConceptPositions([
    { id: 'urn:missing', position: { x: NaN, y: NaN } },
    { id: 'urn:n1', position: { x: NaN, y: NaN } },
    { id: 'urn:n1', position: { x: 10, y: 20 } },
  ])
  assert.equal(notifications, 1)
  assert.deepEqual(store.getState().graph.concepts[0].position, { x: 10, y: 20 })
  const before = store.getState()
  store.setConceptPositions([
    { id: 'urn:n1', position: { x: 30, y: 40 } },
    { id: 'urn:n1', position: { x: 10, y: 20 } },
  ])
  assert.equal(store.getState(), before)
  assert.equal(notifications, 1)
})

test('domain no-ops preserve state identity and do not notify subscribers', () => {
  const { store } = createNessoStore(fixture())
  const before = store.getState()
  let notifications = 0
  store.subscribe(() => notifications++)
  store.setConceptPositions([])
  store.setConceptPositions([{ id: 'urn:missing', position: { x: 1, y: 2 } }])
  store.setConceptPosition('urn:n1', { x: 0, y: 0 })
  store.setConceptLabel('urn:n1', 'One')
  store.setConceptLabel('urn:missing', 'Missing')
  store.addTags('urn:n1', [' ', ''])
  store.removeTag('urn:n1', 'missing')
  store.removeConcept('urn:missing')
  store.removeRelation('missing')
  assert.equal(store.getState(), before)
  assert.equal(notifications, 0)
})

test('domain writes share surviving objects without mutating previous snapshots', () => {
  const writes: ((store: NessoStore) => void)[] = [
    (store) => store.setConceptPosition('urn:n1', { x: 10, y: 20 }),
    (store) => store.setConceptLabel('urn:n1', 'Renamed'),
    (store) => store.addTags('urn:n1', ['New', ' new ']),
    (store) => store.removeTag('urn:n1', 'Existing'),
    (store) => { store.addConcept() },
    (store) => store.connect('urn:n2', 'urn:n3'),
    (store) => store.setRelationType(relationKey(store.getState().graph.relations[0]), 'urn:part'),
    (store) => store.createRelationType(relationKey(store.getState().graph.relations[0]), 'Custom'),
    (store) => store.removeRelation(relationKey(store.getState().graph.relations[0])),
    (store) => store.removeConcept('urn:n2'),
  ]
  for (const write of writes) {
    const graph = fixture()
    graph.concepts[0].tags = ['Existing']
    const { store, registerVocab } = createNessoStore(graph)
    registerVocab(vocabA)
    const before = store.getState()
    const snapshot = structuredClone(before)
    write(store)
    const after = store.getState()
    assert.equal(after.graph.concepts.find(({ id }) => id === 'urn:n3'), before.graph.concepts[2])
    assert.equal(after.graph.relations.find((relation) => relationKey(relation) === relationKey(before.graph.relations[1])), before.graph.relations[1])
    assert.equal(after.graph.relationTypes[0], before.graph.relationTypes[0])
    assert.deepEqual(before, snapshot)
    assert.deepEqual(validateGraph(after.graph), [])
  }
})
