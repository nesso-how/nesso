import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoStore, VocabDefinition } from '@nesso/plugin'
import { relationKey, SchemaError, validateGraph, type Graph } from '@nesso/schema'
import { createNessoStore } from './create.ts'
import { NessoError } from './errors.ts'
import { sectionIds, type SectionId } from './types.ts'

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

test('invalid batches leave state untouched whether validation or an operation fails', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setSelection({ kind: 'relation', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' }) })
  const before = host.store.getState()
  let notifications = 0
  host.store.subscribe(() => notifications++)
  const issues = issuesOf(() => host.store.applyOperations([
    { kind: 'concept.label', id: 'urn:n1', value: 'Mutated' },
    { kind: 'relation.connect', source: 'urn:n1', target: 'urn:missing' },
  ]))
  assert.ok(issues.some(({ path, message }) => path === 'relations[2]' && message.includes('urn:missing')))
  assert.equal(host.store.getState(), before)
  assert.throws(() => host.store.applyOperations([
    { kind: 'concept.remove', id: 'urn:n2' },
    { kind: 'relation.type', id: relationKey(before.graph.relations[1]), typeId: 'urn:unknown' },
  ]), SchemaError)
  assert.throws(() => host.store.applyOperations([
    { kind: 'concept.label', id: 'urn:n1', value: 'Mutated' },
    { kind: 'concept.add', id: 'urn:n1' },
  ]), SchemaError)
  assert.throws(() => host.store.applyOperations([
    { kind: 'concept.label', id: 'urn:n1', value: 'Mutated' },
    { kind: 'relation.type.create', id: relationKey(before.graph.relations[0]), typeId: 'urn:links', label: 'Other' },
  ]), SchemaError)
  assert.equal(host.store.getState(), before)
  assert.equal(notifications, 0)
  host.store.setConceptLabel('urn:n1', 'Renamed')
  assert.equal(host.store.getState().graph.concepts[0].label, 'Renamed')
})

test('deleting a concept prunes incident relations, reconciles selection, and keeps one concept', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setSelection({ kind: 'relation', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' }) })
  host.store.removeConcept('urn:n1')
  const state = host.store.getState()
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
  assert.equal(host.store.getState().preferences.activeVocabId, 'b')
  assert.equal(host.store.getState().graph, document)
  host.store.setSelection({ kind: 'concept', id: 'urn:n1' })
  const added = host.store.addConcept()
  const state = host.store.getState()
  assert.deepEqual(state.graph.relations.at(-1), { source: 'urn:n1', predicate: 'urn:ext', target: added })
  assert.deepEqual(state.graph.relationTypes.at(-1), { id: 'urn:ext', label: 'ext' })
  assert.ok(state.graph.relationTypes.some(({ id: typeId }) => typeId === 'urn:links'))
})

test('saved views materialize shared subsets, reconcile membership and never change the graph', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  let state = host.store.getState()
  assert.equal(state.workspace.activeViewId, null)
  assert.deepEqual(state.viewGraph.concepts.map((concept) => concept.id), ['urn:n1', 'urn:n2', 'urn:n3'])
  const graph = state.graph
  const id = host.ui.createView('Pair', ['urn:n1', 'urn:n2'])
  state = host.store.getState()
  assert.equal(state.workspace.activeViewId, id)
  assert.equal(state.graph, graph)
  assert.deepEqual(state.viewGraph.concepts.map((concept) => concept.id), ['urn:n1', 'urn:n2'])
  assert.deepEqual(state.viewGraph.relations, [{ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' }])
  assert.deepEqual(state.viewGraph.relationTypes, [{ id: 'urn:links', label: 'links' }])
  host.store.setSelection({ kind: 'concept', id: 'urn:n2' })
  host.ui.setViewMembership(id, 'urn:n2', false)
  assert.deepEqual(host.store.getState().selected, { kind: 'concept', id: 'urn:n2' })
  assert.deepEqual(host.store.getState().viewGraph.relations, [])
  host.ui.setViewMembership(id, 'urn:n2', true)
  const beforePin = host.store.getState()
  host.ui.setViewPinned(id, true)
  assert.equal(host.store.getState().viewGraph, beforePin.viewGraph)
  const added = host.store.addConcept()
  assert.ok(host.store.getState().workspace.savedViews[0].conceptIds.includes(added))
  host.store.removeConcept(added)
  assert.equal(host.store.getState().workspace.savedViews[0].conceptIds.includes(added), false)
  const empty = host.ui.createView('Empty', [])
  assert.deepEqual(host.ui.getViewGraph(empty).concepts, [])
  assert.equal(host.ui.getViewGraph(empty).relationTypes, host.store.getState().graph.relationTypes)
  assert.deepEqual(host.ui.getViewGraph(id).concepts.map(({ id }) => id), ['urn:n1', 'urn:n2'])
  host.ui.deleteView(empty)
  assert.equal(host.store.getState().workspace.activeViewId, null)
  assert.equal(host.store.getState().viewGraph, host.store.getState().graph)
})

test('switching views preserves visible selections, including every selection in the complete graph', () => {
  const host = createNessoStore(fixture())
  const pair = host.ui.createView('Pair', ['urn:n1', 'urn:n2'])
  const other = host.ui.createView('Other', ['urn:n1', 'urn:n3'])
  const graph = host.store.getState().graph
  for (const selected of [
    { kind: 'concept', id: 'urn:n1' },
    { kind: 'relation', id: relationKey(graph.relations[0]) },
  ] as const) {
    host.store.setSelection(selected)
    host.store.setView(pair)
    assert.deepEqual(host.store.getState().selected, selected)
    host.store.setView(null)
    assert.deepEqual(host.store.getState().selected, selected)
    assert.equal(host.store.getState().viewGraph, graph)
    host.store.setView(other)
    assert.deepEqual(host.store.getState().selected, selected.kind === 'concept' ? selected : null)
    assert.equal(host.store.getState().graph, graph)
  }
  host.store.setSelection({ kind: 'concept', id: 'urn:n3' })
  host.store.setView(pair)
  assert.equal(host.store.getState().selected, null)
})

test('new concepts link only to a selected concept and join the active view atomically', () => {
  for (const subset of [false, true]) {
    for (const kind of ['concept', 'relation', null] as const) {
      const host = createNessoStore(fixture())
      host.registerVocab(vocabB)
      const viewId = subset ? host.ui.createView('Pair', ['urn:n1', 'urn:n2']) : null
      host.store.setSelection(kind === 'concept'
        ? { kind, id: 'urn:n2' }
        : kind === 'relation' ? { kind, id: relationKey(host.store.getState().graph.relations[0]) } : null)
      const before = host.store.getState()
      let notifications = 0
      host.store.subscribe(() => notifications++)
      const id = host.store.addConcept()
      const after = host.store.getState()
      assert.equal(notifications, 1)
      assert.deepEqual(after.selected, { kind: 'concept', id })
      assert.equal(after.graph.concepts.length, before.graph.concepts.length + 1)
      if (kind === 'concept') {
        const relation = { source: 'urn:n2', predicate: vocabB.defaultTypeId, target: id }
        assert.deepEqual(after.graph.relations.at(-1), relation)
        assert.deepEqual(after.viewGraph.relations.at(-1), relation)
        assert.equal(after.graph.relations.length, before.graph.relations.length + 1)
        assert.deepEqual(after.graph.relationTypes.at(-1), vocabB.relationTypes[0])
      } else {
        assert.equal(after.graph.relations, before.graph.relations)
        assert.equal(after.graph.relationTypes, before.graph.relationTypes)
      }
      if (viewId) {
        assert.ok(after.workspace.savedViews.find((view) => view.id === viewId)?.conceptIds.includes(id))
      } else {
        assert.equal(after.viewGraph, after.graph)
      }
      assert.deepEqual(validateGraph(after.graph), [])
    }
  }
})

test('renderer registration rejects duplicate ids and unknown activation, first one becomes active', () => {
  const host = createNessoStore(fixture())
  const renderer = { id: 'graph', label: 'Graph', component: () => null }
  host.registerRenderer(renderer)
  assert.equal(host.store.getState().preferences.activeRendererId, 'graph')
  const issues = issuesOf(() => host.registerRenderer({ ...renderer, label: 'Other' }))
  assert.deepEqual(issues, [{ path: 'renderer.id', message: 'Duplicate renderer id: graph' }])
  assert.match(issuesOf(() => host.store.setActiveRenderer('other')).map(({ message }) => message).join(' '), /Unknown renderer/)
  assert.equal(host.getRenderer('graph'), renderer)
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

test('mixed batches publish once, apply in order and own inputs while sharing untouched objects', () => {
  const { store } = createNessoStore(fixture())
  const before = store.getState()
  const snapshot = structuredClone(before)
  const rename = { kind: 'concept.label' as const, id: 'urn:n1', value: 'Renamed' }
  const position = { x: 10, y: 20 }
  let notifications = 0
  store.subscribe(() => notifications++)
  store.applyOperations([
    rename,
    { kind: 'concept.position', id: 'urn:n2', value: position },
    { kind: 'concept.label', id: 'urn:n2', value: 'Temporary' },
    { kind: 'concept.label', id: 'urn:n2', value: 'Second' },
  ])
  const after = store.getState()
  assert.equal(notifications, 1)
  assert.equal(after.graph.concepts[0].label, 'Renamed')
  assert.equal(after.graph.concepts[1].label, 'Second')
  assert.deepEqual(after.graph.concepts[1].position, position)
  assert.equal(after.graph.concepts[2], before.graph.concepts[2])
  assert.equal(after.graph.relations, before.graph.relations)
  assert.equal(after.graph.relationTypes, before.graph.relationTypes)
  assert.equal(after.viewGraph.concepts[1], after.graph.concepts[1])
  assert.deepEqual(before, snapshot)
  const published = structuredClone(after)
  rename.value = 'External mutation'
  position.x = NaN
  assert.deepEqual(store.getState(), published)
  assert.equal(notifications, 1)
})

test('batches can reference new concepts and types and reconcile navigation after deletion', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  const viewId = host.ui.createView('All', ['urn:n1', 'urn:n2', 'urn:n3'])
  host.store.setSelection({ kind: 'concept', id: 'urn:n1' })
  const relation = { source: 'urn:n4', predicate: 'urn:links', target: 'urn:n5' }
  let notifications = 0
  host.store.subscribe(() => notifications++)
  host.store.applyOperations([
    { kind: 'concept.add', id: 'urn:n4' },
    { kind: 'concept.label', id: 'urn:n4', value: 'Four' },
    { kind: 'concept.add', id: 'urn:n5' },
    { kind: 'relation.connect', source: relation.source, target: relation.target },
    { kind: 'relation.type.create', id: relationKey(relation), typeId: 'urn:custom', label: ' Custom ' },
    { kind: 'relation.type', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n4' }), typeId: 'urn:custom' },
    { kind: 'concept.remove', id: 'urn:n1' },
  ])
  const state = host.store.getState()
  assert.equal(notifications, 1)
  assert.equal(state.graph.concepts.find((concept) => concept.id === 'urn:n4')?.label, 'Four')
  assert.deepEqual(state.graph.relations, [{ ...relation, predicate: 'urn:custom' }])
  assert.deepEqual(state.graph.relationTypes.at(-1), { id: 'urn:custom', label: 'Custom' })
  assert.equal(state.workspace.activeViewId, viewId)
  assert.deepEqual(state.workspace.savedViews[0].conceptIds, ['urn:n2', 'urn:n3', 'urn:n4', 'urn:n5'])
  assert.equal(state.selected, null)
  assert.deepEqual(state.viewGraph.concepts.map((concept) => concept.id), ['urn:n2', 'urn:n3', 'urn:n4', 'urn:n5'])
})

test('empty and cancelling batches preserve state identity and do not notify', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setSelection({ kind: 'concept', id: 'urn:n1' })
  const before = host.store.getState()
  const relation = { source: 'urn:n2', predicate: 'urn:links', target: 'urn:n3' }
  let notifications = 0
  host.store.subscribe(() => notifications++)
  host.store.applyOperations([])
  host.store.applyOperations([
    { kind: 'concept.label', id: 'urn:n1', value: 'Temporary' },
    { kind: 'concept.label', id: 'urn:n1', value: 'One' },
    { kind: 'concept.position', id: 'urn:n1', value: { x: NaN, y: 10 } },
    { kind: 'concept.position', id: 'urn:n1', value: { x: 0, y: 0 } },
    { kind: 'relation.connect', source: relation.source, target: relation.target },
    { kind: 'relation.remove', id: relationKey(relation) },
  ])
  assert.equal(host.store.getState(), before)
  assert.equal(notifications, 0)
})

test('batches validate only the final document and link additions only to a surviving selection', () => {
  for (const empty of [false, true]) {
    const host = createNessoStore(fixture())
    host.registerVocab(vocabA)
    const removals = empty ? ['urn:n1', 'urn:n2', 'urn:n3'] : ['urn:n1', 'urn:n3']
    host.store.setSelection({ kind: 'concept', id: 'urn:n2' })
    let notifications = 0
    host.store.subscribe(() => notifications++)
    host.store.applyOperations([
      ...removals.map((id) => ({ kind: 'concept.remove' as const, id })),
      { kind: 'concept.add', id: 'urn:n4' },
    ])
    const state = host.store.getState()
    assert.equal(notifications, 1)
    assert.deepEqual(state.graph.concepts.map((concept) => concept.id), empty ? ['urn:n4'] : ['urn:n2', 'urn:n4'])
    assert.deepEqual(state.graph.relations, empty ? [] : [{ source: 'urn:n2', predicate: 'urn:links', target: 'urn:n4' }])
    assert.deepEqual(state.selected, { kind: 'concept', id: 'urn:n4' })
  }
})

test('custom relation types disappear only after their last use in the whole graph is removed', () => {
  for (const action of ['retype', 'delete', 'concept'] as const) {
    const graph = fixture()
    graph.relationTypes.push({ id: 'urn:unused', label: 'Unused definition' })
    const host = createNessoStore(graph)
    host.registerVocab(vocabA)
    host.store.createRelationType(relationKey(graph.relations[0]), 'Custom')
    const type = host.store.getState().graph.relationTypes.at(-1)!
    host.store.setRelationType(relationKey(graph.relations[1]), type.id)
    host.ui.createView('Pair', ['urn:n1', 'urn:n2'])
    host.store.setRelationType(relationKey(host.store.getState().graph.relations[0]), vocabA.defaultTypeId)
    const before = host.store.getState()
    assert.ok(before.graph.relationTypes.includes(type))
    assert.ok(before.viewGraph.relationTypes.includes(type))
    assert.equal(before.viewGraph.relations.some((relation) => relation.predicate === type.id), false)
    const last = relationKey(before.graph.relations[1])
    let notifications = 0
    host.store.subscribe(() => notifications++)
    if (action === 'retype') host.store.setRelationType(last, vocabA.defaultTypeId)
    else if (action === 'delete') host.store.removeRelation(last)
    else host.store.removeConcept('urn:n3')
    const after = host.store.getState()
    assert.equal(notifications, 1)
    assert.equal(after.graph.relationTypes.some((item) => item.id === type.id), false)
    assert.equal(after.viewGraph.relationTypes.some((item) => item.id === type.id), false)
    assert.ok(after.graph.relationTypes.some((item) => item.id === vocabA.defaultTypeId))
    assert.ok(after.graph.relationTypes.some((item) => item.id === 'urn:unused'))
    assert.ok(before.graph.relationTypes.includes(type))
    assert.deepEqual(validateGraph(after.graph), [])
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
    host.store.setSelection({ kind: 'concept', id: 'urn:n1' })
    host.store.addConcept()
    const state = host.store.getState()
    assert.equal(state.preferences.activeVocabId, 'shared')
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
  for (const subset of [true, false]) {
    const graph = fixture()
    graph.relations.pop()
    const { store, ui } = createNessoStore(graph)
    if (subset) ui.createView('Pair', ['urn:n1', 'urn:n2'])
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
      assert.equal(after.viewGraph.concepts[index], after.graph.concepts[index])
    }
    assert.equal(after.graph.concepts[2], before.graph.concepts[2])
    assert.equal(after.graph.relations, before.graph.relations)
    assert.equal(after.graph.relationTypes, before.graph.relationTypes)
    if (!subset) assert.equal(after.viewGraph, after.graph)
    else assert.deepEqual(after.viewGraph.concepts.map(({ id }) => id), ['urn:n1', 'urn:n2'])
    assert.deepEqual(before, snapshot)
    updates[0].position.x = NaN
    assert.deepEqual(after.graph.concepts[0].position, { x: 10, y: 20 })
  }
})

test('position batches reject invalid coordinates atomically in every view mode', () => {
  for (const subset of [true, false]) {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const { store, ui } = createNessoStore(fixture())
      if (subset) ui.createView('Pair', ['urn:n1', 'urn:n2'])
      store.setSelection({ kind: 'concept', id: 'urn:n2' })
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
  store.removeConcept('urn:missing')
  store.removeRelation('missing')
  assert.equal(store.getState(), before)
  assert.equal(notifications, 0)
})

test('domain writes share surviving objects without mutating previous snapshots', () => {
  const writes: ((store: NessoStore) => void)[] = [
    (store) => store.setConceptPosition('urn:n1', { x: 10, y: 20 }),
    (store) => store.setConceptLabel('urn:n1', 'Renamed'),
    (store) => { store.addConcept() },
    (store) => store.connect('urn:n2', 'urn:n3'),
    (store) => store.setRelationType(relationKey(store.getState().graph.relations[0]), 'urn:part'),
    (store) => store.createRelationType(relationKey(store.getState().graph.relations[0]), 'Custom'),
    (store) => store.removeRelation(relationKey(store.getState().graph.relations[0])),
    (store) => store.removeConcept('urn:n2'),
  ]
  for (const write of writes) {
    const graph = fixture()
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

test('restoration resolves saved plugin preferences, falling back when unavailable', () => {
  for (const missing of [false, true]) {
    const host = createNessoStore(fixture(), {
      workspace: { activeViewId: null, savedViews: [], viewports: {} },
      preferences: {
        activeVocabId: missing ? 'removed' : 'b', activeRendererId: missing ? 'removed' : 'other',
        activeThemeId: missing ? 'removed' : 'alternative',
        panels: { explorerWidth: 256, inspectorWidth: 280 },
      },
    })
    host.registerVocab(vocabA)
    host.registerVocab(vocabB)
    for (const id of ['graph', 'other']) host.registerRenderer({ id, label: id, component: () => null })
    for (const id of ['light', 'alternative']) host.registerTheme({ id, label: id })
    const state = host.store.getState()
    assert.equal(state.preferences.activeVocabId, missing ? 'a' : 'b')
    assert.equal(state.preferences.activeRendererId, missing ? 'graph' : 'other')
    assert.equal(state.preferences.activeThemeId, missing ? 'light' : 'alternative')
    assert.equal(state.viewGraph, state.graph)
    assert.equal(state.selected, null)
    assert.deepEqual(state.graph, fixture())
  }
})

test('section preferences are global, immutable, validated and independent of the document', () => {
  const host = createNessoStore(fixture())
  host.store.setSelection({ kind: 'concept', id: 'urn:n1' })
  const before = host.store.getState()
  let notifications = 0
  host.store.subscribe(() => notifications++)
  for (const id of sectionIds) {
    const previous = host.store.getState()
    host.ui.setSectionOpen(id, true)
    assert.equal(host.store.getState(), previous)
    host.ui.setSectionOpen(id, false)
    const closed = host.store.getState()
    assert.deepEqual(closed.preferences.collapsedSections, [id])
    assert.equal(closed.graph, before.graph)
    assert.equal(closed.workspace, before.workspace)
    assert.equal(closed.viewGraph, before.viewGraph)
    assert.equal(closed.selected, before.selected)
    assert.equal(previous.preferences.collapsedSections?.includes(id) ?? false, false)
    host.ui.setSectionOpen(id, false)
    assert.equal(host.store.getState(), closed)
    host.ui.setSectionOpen(id, true)
    assert.deepEqual(host.store.getState().preferences.collapsedSections, [])
    assert.deepEqual(closed.preferences.collapsedSections, [id])
  }
  assert.equal(notifications, sectionIds.length * 2)
  const collapsedSections: SectionId[] = ['sidebar', 'inspector.views']
  const restored = createNessoStore(fixture(), { preferences: { ...before.preferences, collapsedSections } })
  collapsedSections.push('inspector.nodes')
  assert.deepEqual(restored.store.getState().preferences.collapsedSections, ['sidebar', 'inspector.views'])
  const state = host.store.getState()
  assert.throws(() => host.ui.setSectionOpen('missing' as SectionId, false), NessoError)
  assert.throws(() => host.ui.setSectionOpen('sidebar', null as unknown as boolean), NessoError)
  assert.equal(host.store.getState(), state)
})

test('UI and viewport writes own their inputs, ignore no-ops and reject invalid changes atomically', () => {
  const host = createNessoStore(fixture())
  host.registerRenderer({ id: 'graph', label: 'Graph', component: () => null })
  const graph = host.store.getState().graph
  const conceptIds = ['urn:n1', 'urn:n2']
  const panels = { explorerWidth: 300, inspectorWidth: 350 }
  const viewport = { x: 100, y: -200, zoom: 0.8 }
  const viewId = host.ui.createView('Pair', conceptIds)
  host.ui.setPanelSizes(panels)
  host.store.setViewport('graph', viewport)
  conceptIds.push('urn:n3')
  panels.explorerWidth = NaN
  viewport.x = NaN
  const state = host.store.getState()
  assert.equal(state.graph, graph)
  assert.deepEqual(state.workspace.savedViews[0].conceptIds, ['urn:n1', 'urn:n2'])
  assert.deepEqual(state.workspace.viewports.graph, { x: 100, y: -200, zoom: 0.8 })
  assert.deepEqual(state.preferences.panels, { explorerWidth: 300, inspectorWidth: 350 })
  let notifications = 0
  host.store.subscribe(() => notifications++)
  host.ui.setViewMembership(viewId, 'urn:n1', true)
  host.ui.setViewPinned(viewId, false)
  host.store.setView(viewId)
  host.ui.setPanelSizes({ explorerWidth: 300, inspectorWidth: 350 })
  host.store.setViewport('graph', { x: 100, y: -200, zoom: 0.8 })
  assert.equal(host.store.getState(), state)
  assert.equal(notifications, 0)
  const writes = [
    () => host.ui.createView('', []),
    () => host.ui.createView('Invalid', ['missing']),
    () => host.ui.setViewMembership(viewId, 'missing', true),
    () => host.ui.deleteView('missing'),
    () => host.ui.setPanelSizes({ explorerWidth: 500, inspectorWidth: 300 }),
    () => host.ui.setPanelSizes({ explorerWidth: 300, inspectorWidth: 100 }),
    () => host.store.setViewport('missing', { x: 0, y: 0, zoom: 1 }),
    () => host.store.setViewport('graph', { x: Infinity, y: 0, zoom: 1 }),
    () => host.store.setViewport('graph', { x: 0, y: 0, zoom: 0 }),
  ]
  for (const write of writes) {
    assert.throws(write, (error: unknown) => error instanceof NessoError && error.issues.length > 0)
    assert.equal(host.store.getState(), state)
  }
})

test('theme registration and activation are validated, isolated, and leave the document untouched', () => {
  const host = createNessoStore(fixture())
  const other = createNessoStore(fixture())
  const before = host.store.getState()
  const theme = { id: 'light', label: 'Light' }
  host.registerTheme(theme)
  theme.label = 'Changed externally'
  assert.deepEqual(host.getTheme('light'), { id: 'light', label: 'Light' })
  assert.deepEqual(other.listThemes(), [])
  assert.equal(other.store.getState().preferences.activeThemeId, '')
  host.registerTheme({ id: 'alternative', label: 'Alternative' })
  assert.deepEqual(host.listThemes().map(({ id }) => id), ['light', 'alternative'])
  assert.equal(host.store.getState().preferences.activeThemeId, 'light')
  const snapshot = host.store.getState()
  let notifications = 0
  host.store.subscribe(() => notifications++)
  for (const invalid of [
    { id: 'light', label: 'Duplicate' },
    { id: '', label: 'Missing id' },
    { id: ' ', label: 'Blank id' },
    { id: 'invalid', label: '' },
  ]) {
    assert.throws(() => host.registerTheme(invalid), NessoError)
    assert.equal(host.store.getState(), snapshot)
  }
  assert.equal(host.getTheme('invalid'), undefined)
  assert.throws(() => host.ui.setActiveTheme('missing'), (error: unknown) =>
    error instanceof NessoError && error.issues[0].path === 'preferences.activeThemeId')
  host.ui.setActiveTheme('light')
  assert.equal(host.store.getState(), snapshot)
  assert.equal(notifications, 0)
  host.ui.setActiveTheme('alternative')
  assert.equal(host.store.getState().preferences.activeThemeId, 'alternative')
  assert.equal(notifications, 1)
  assert.equal(host.store.getState().graph, before.graph)
  assert.equal(host.store.getState().workspace, before.workspace)
  assert.equal(host.store.getState().viewGraph, before.viewGraph)
  const preferences = host.store.getState().preferences
  host.ui.resetGraph()
  assert.equal(host.store.getState().preferences, preferences)
})
