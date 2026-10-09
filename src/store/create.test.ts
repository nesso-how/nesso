import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoOperation, SectionId, Selection, VocabDefinition } from '@nesso/plugin'
import { relationKey, SchemaError, type Graph } from '@nesso/schema'
import { maxConceptLabelLength, maxRelationLabelLength } from './settings.ts'
import { createNessoStore } from './create.ts'
import { NessoError } from './errors.ts'
import { sectionIds } from './types.ts'

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
  relationTypes: [
    { id: 'urn:links', label: 'links' },
    { id: 'urn:part', label: 'part' },
    { id: 'urn:ext', label: 'external' },
  ],
  defaultTypeId: 'urn:links',
}

const vocabB: VocabDefinition = {
  id: 'b',
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

test('conversation writes are validated, isolated from document history and cleared atomically on reset', () => {
  const { store } = createNessoStore(fixture())
  store.setConceptLabel('urn:n1', 'Changed')
  store.undo()
  const before = store.getState()
  const messages = [{ id: 'user', role: 'user' as const, content: 'Hello' }]
  let notifications = 0
  store.subscribe(() => notifications++)
  store.setChatMessages(messages)
  const saved = store.getState()
  messages[0].content = 'Mutated'
  assert.equal(saved.conversation.messages[0].content, 'Hello')
  assert.equal(saved.graph, before.graph)
  assert.equal(saved.workspace, before.workspace)
  assert.equal(saved.preferences, before.preferences)
  assert.equal(saved.history, before.history)
  assert.equal(notifications, 1)
  store.setChatMessages(saved.conversation.messages)
  assert.equal(store.getState(), saved)
  assert.equal(notifications, 1)
  assert.throws(() => store.applyOperations([
    { kind: 'concept.label', id: 'urn:n1', value: 'Invalid batch' },
    { kind: 'conversation.messages', value: [{ id: '', role: 'user', content: 'Invalid' }] },
  ]), NessoError)
  assert.throws(() => store.applyOperations([
    { kind: 'conversation.clear' },
    { kind: 'concept.add', id: 'urn:n1' },
  ]), SchemaError)
  assert.equal(store.getState(), saved)
  store.redo()
  assert.equal(store.getState().conversation, saved.conversation)
  store.clearChat()
  assert.deepEqual(store.getState().conversation.messages, [])
  assert.equal(store.getState().history.canUndo, true)
  store.setChatMessages(saved.conversation.messages)
  notifications = 0
  store.resetGraph()
  assert.equal(notifications, 1)
  assert.deepEqual(store.getState().conversation.messages, [])
  assert.deepEqual(store.getState().history, { canUndo: false, canRedo: false })
})

test('invalid batches leave state untouched whether validation or an operation fails', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setSelection([{ kind: 'relation', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' }) }])
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

test('overlong concept and relation labels are rejected atomically at every write boundary', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setConceptLabel('urn:n1', 'a'.repeat(maxConceptLabelLength))
  const edgeId = relationKey(host.store.getState().graph.relations[0])
  host.store.createRelationType(edgeId, 'b'.repeat(maxRelationLabelLength))
  const before = host.store.getState()
  let notifications = 0
  host.store.subscribe(() => notifications++)
  assert.throws(() => host.store.setConceptLabel('urn:n1', 'a'.repeat(maxConceptLabelLength + 1)), SchemaError)
  assert.throws(() => host.store.createRelationType(relationKey(before.graph.relations[0]), 'b'.repeat(maxRelationLabelLength + 1)), SchemaError)
  assert.throws(() => host.registerVocab({ ...vocabB, relationTypes: [{ id: 'urn:ext', label: 'b'.repeat(maxRelationLabelLength + 1) }] }), SchemaError)
  assert.equal(host.store.getState(), before)
  assert.equal(notifications, 0)
  const graph = fixture()
  graph.concepts[0].label = 'a'.repeat(maxConceptLabelLength + 1)
  assert.throws(() => createNessoStore(graph), SchemaError)
})

test('deleting a concept prunes incident relations, reconciles selection, and keeps one concept', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.store.setSelection([
    { kind: 'relation', id: relationKey({ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n3' }) },
    { kind: 'concept', id: 'urn:n2' },
  ])
  host.store.removeConcept('urn:n1')
  const state = host.store.getState()
  assert.deepEqual(state.graph.relations, [])
  assert.deepEqual(state.selected, [{ kind: 'concept', id: 'urn:n2' }])
  host.store.removeConcept('urn:n3')
  assert.match(issuesOf(() => host.store.removeConcept('urn:n2')).map(({ message }) => message).join(' '), /at least one concept/)
  assert.equal(host.store.getState().graph.concepts.length, 1)
  host.store.setSelection([{ kind: 'relation', id: relationKey({ source: 'urn:n2', predicate: 'urn:links', target: 'urn:n1' }) }])
  assert.deepEqual(host.store.getState().selected, [])
  host.store.setSelection([{ kind: 'concept', id: 'urn:n2' }])
  assert.deepEqual(host.store.getState().selected, [{ kind: 'concept', id: 'urn:n2' }])
})

test('vocab registration validates, switching never rewrites the document, and using a new default adds its type', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  assert.match(issuesOf(() => host.registerVocab(vocabA)).map(({ path, message }) => `${path} ${message}`).join(' '), /^id /)
  assert.match(
    issuesOf(() => host.registerVocab({ id: 'bad', relationTypes: [], defaultTypeId: 'urn:ext' })).map(({ path }) => path).join(' '),
    /^defaultTypeId$/,
  )
  assert.match(issuesOf(() => host.registerVocab({
    id: 'dup',
    relationTypes: [{ id: 'urn:links', label: 'links' }, { id: 'urn:links', label: 'again' }],
    defaultTypeId: 'urn:links',
  })).map(({ path }) => path).join(' '), /relationTypes\[1\]\.id/)
  assert.match(issuesOf(() => host.registerVocab({
    id: 'empty',
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
  host.store.connect('urn:n2', 'urn:n3')
  const state = host.store.getState()
  assert.deepEqual(state.graph.relations.at(-1), { source: 'urn:n2', predicate: 'urn:ext', target: 'urn:n3' })
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
  const id = host.store.createView('Pair', ['urn:n1', 'urn:n2'])
  state = host.store.getState()
  assert.equal(state.workspace.activeViewId, id)
  assert.equal(state.graph, graph)
  assert.deepEqual(state.viewGraph.concepts.map((concept) => concept.id), ['urn:n1', 'urn:n2'])
  assert.deepEqual(state.viewGraph.relations, [{ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' }])
  assert.deepEqual(state.viewGraph.relationTypes, [{ id: 'urn:links', label: 'links' }])
  const selected: Selection = [{ kind: 'concept', id: 'urn:n1' }, { kind: 'concept', id: 'urn:n2' }]
  host.store.setSelection(selected)
  host.store.setViewMembership(id, 'urn:n2', false)
  assert.deepEqual(host.store.getState().selected, selected)
  assert.deepEqual(host.store.getState().viewGraph.relations, [])
  host.store.setViewMembership(id, 'urn:n2', true)
  const beforePin = host.store.getState()
  host.store.setViewPinned(id, true)
  assert.equal(host.store.getState().viewGraph, beforePin.viewGraph)
  const added = host.store.addConcept()
  assert.ok(host.store.getState().workspace.savedViews[0].conceptIds.includes(added))
  host.store.removeConcept(added)
  assert.equal(host.store.getState().workspace.savedViews[0].conceptIds.includes(added), false)
  const empty = host.store.createView('Empty', [])
  assert.deepEqual(host.store.getViewGraph(empty).concepts, [])
  assert.equal(host.store.getViewGraph(empty).relationTypes, host.store.getState().graph.relationTypes)
  assert.deepEqual(host.store.getViewGraph(id).concepts.map(({ id }) => id), ['urn:n1', 'urn:n2'])
  host.store.deleteView(empty)
  assert.equal(host.store.getState().workspace.activeViewId, null)
  assert.equal(host.store.getState().viewGraph, host.store.getState().graph)
})

test('switching views preserves visible selections, including every selection in the complete graph', () => {
  const host = createNessoStore(fixture())
  const pair = host.store.createView('Pair', ['urn:n1', 'urn:n2'])
  const other = host.store.createView('Other', ['urn:n1', 'urn:n3'])
  const graph = host.store.getState().graph
  const selected: Selection = [
    { kind: 'concept', id: 'urn:n1' },
    { kind: 'concept', id: 'urn:n2' },
    { kind: 'relation', id: relationKey(graph.relations[0]) },
  ]
  host.store.setSelection(selected)
  host.store.setView(pair)
  assert.deepEqual(host.store.getState().selected, selected)
  host.store.setView(null)
  assert.deepEqual(host.store.getState().selected, selected)
  assert.equal(host.store.getState().viewGraph, graph)
  host.store.setView(other)
  assert.deepEqual(host.store.getState().selected, [selected[0]])
  assert.equal(host.store.getState().graph, graph)
  host.store.setSelection([{ kind: 'concept', id: 'urn:n3' }])
  host.store.setView(pair)
  assert.deepEqual(host.store.getState().selected, [])
})

test('new concepts link only to a selected concept and join the active view atomically', () => {
  for (const subset of [false, true]) {
    for (const kind of ['concept', 'relation', 'concepts', 'mixed', null] as const) {
      const host = createNessoStore(fixture())
      host.registerVocab(vocabB)
      const viewId = subset ? host.store.createView('Pair', ['urn:n1', 'urn:n2']) : null
      const relation = { kind: 'relation' as const, id: relationKey(host.store.getState().graph.relations[0]) }
      host.store.setSelection(kind === 'concept' ? [{ kind, id: 'urn:n2' }]
        : kind === 'relation' ? [relation]
        : kind === 'concepts' || kind === 'mixed' ? [
          { kind: 'concept', id: 'urn:n1' },
          kind === 'mixed' ? relation : { kind: 'concept', id: 'urn:n2' },
        ] : [])
      const before = host.store.getState()
      assert.deepEqual(host.store.conceptPlacementOffset, { x: 160, y: 100 })
      assert.ok(Object.isFrozen(host.store.conceptPlacementOffset))
      let notifications = 0
      host.store.subscribe(() => notifications++)
      const id = host.store.addConcept()
      const after = host.store.getState()
      assert.equal(notifications, 1)
      assert.deepEqual(after.selected, [{ kind: 'concept', id }])
      assert.equal(after.graph.concepts.length, before.graph.concepts.length + 1)
      assert.deepEqual(after.graph.concepts.at(-1)?.position, { x: kind === 'concept' ? 161 : 160, y: 100 })
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
    }
  }
})

test('renderer registration rejects duplicate ids and unknown activation, first one becomes active', () => {
  const host = createNessoStore(fixture())
  const renderer = { id: 'graph', component: () => null }
  host.registerRenderer(renderer)
  assert.equal(host.store.getState().preferences.activeRendererId, 'graph')
  const issues = issuesOf(() => host.registerRenderer({ ...renderer }))
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
    relationTypes: [{ id: 'urn:other-links', label: 'links' }],
    defaultTypeId: 'urn:other-links',
  })
  const before = host.store.getState()
  const id = relationKey(before.graph.relations[0])
  host.store.setRelationType(id, 'urn:links')
  assert.equal(host.store.getState(), before)
  const selected: Selection = [{ kind: 'relation', id }, { kind: 'concept', id: 'urn:n3' }]
  host.store.setSelection(selected)
  host.store.setRelationType(id, 'urn:other-links')
  const state = host.store.getState()
  assert.equal(state.graph.relations[0].predicate, 'urn:other-links')
  assert.deepEqual(state.selected, [{ kind: 'relation', id: relationKey(state.graph.relations[0]) }, selected[1]])
  assert.deepEqual(state.graph.relationTypes, [
    { id: 'urn:links', label: 'links' },
    { id: 'urn:other-links', label: 'links' },
  ])
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
  assert.deepEqual(state.selected, [{ kind: 'relation', id: relationKey(state.graph.relations[0]) }])
})

test('reconnecting either endpoint preserves its predicate, shared objects and view membership', () => {
  for (const endpoint of ['source', 'target'] as const) {
    const graph = fixture()
    graph.relationTypes.push({ id: 'urn:custom', label: 'Custom' })
    graph.relations[0].predicate = 'urn:custom'
    const host = createNessoStore(graph)
    host.registerVocab(vocabB)
    host.store.createView('Pair', ['urn:n1', 'urn:n2'])
    const id = relationKey(graph.relations[0])
    const selected: Selection = [{ kind: 'relation', id }, { kind: 'concept', id: 'urn:n3' }]
    host.store.setSelection(selected)
    const before = host.store.getState()
    const snapshot = structuredClone(before)
    let notifications = 0
    host.store.subscribe(() => notifications++)
    const expected = { ...graph.relations[0], [endpoint]: 'urn:n3' }
    host.store.reconnectRelation(id, expected.source, expected.target)
    const after = host.store.getState()
    assert.equal(notifications, 1)
    assert.deepEqual(after.graph.relations[0], expected)
    assert.deepEqual(after.selected, [{ kind: 'relation', id: relationKey(expected) }, selected[1]])
    assert.equal(after.graph.relations[1], before.graph.relations[1])
    assert.equal(after.graph.relationTypes, before.graph.relationTypes)
    assert.equal(after.graph.concepts, before.graph.concepts)
    assert.equal(after.workspace, before.workspace)
    assert.deepEqual(after.viewGraph.relations, [])
    assert.deepEqual(before, snapshot)
  }
})

test('invalid reconnects roll back atomically and duplicate, self or unchanged reconnects are no-ops', () => {
  const { store } = createNessoStore(fixture())
  const id = relationKey(store.getState().graph.relations[0])
  store.setSelection([{ kind: 'relation', id }])
  const before = store.getState()
  let notifications = 0
  store.subscribe(() => notifications++)
  for (const [edgeId, source, target] of [
    [id, 'urn:n1', 'urn:n2'],
    [id, 'urn:n1', 'urn:n3'],
    [id, 'urn:n1', 'urn:n1'],
    [id, '', 'urn:n2'],
    ['missing', 'urn:n2', 'urn:n3'],
  ]) store.reconnectRelation(edgeId, source, target)
  assert.throws(() => store.applyOperations([
    { kind: 'concept.label', id: 'urn:n1', value: 'Temporary' },
    { kind: 'relation.reconnect', id, source: 'urn:missing', target: 'urn:n2' },
  ]), SchemaError)
  assert.equal(store.getState(), before)
  assert.equal(notifications, 0)
})

test('mixed batches publish once, apply in order and own inputs while sharing untouched objects', () => {
  for (const subset of [false, true]) {
    const { store } = createNessoStore(fixture())
    if (subset) store.createView('Pair', ['urn:n1', 'urn:n2'])
    const before = store.getState()
    const snapshot = structuredClone(before)
    const rename = { kind: 'concept.label' as const, id: 'urn:n1', value: 'Renamed' }
    const updates = [
      { id: 'urn:n1', position: { x: 10, y: 20 } },
      { id: 'urn:n2', position: { x: 30, y: 40 } },
    ]
    let notifications = 0
    store.subscribe(() => notifications++)
    store.applyOperations([
      rename,
      { kind: 'concept.positions', updates },
      { kind: 'concept.label', id: 'urn:n2', value: 'Temporary' },
      { kind: 'concept.label', id: 'urn:n2', value: 'Second' },
    ])
    const after = store.getState()
    assert.equal(notifications, 1)
    assert.equal(after.graph.concepts[0].label, 'Renamed')
    assert.equal(after.graph.concepts[1].label, 'Second')
    assert.deepEqual(after.graph.concepts.map(({ position }) => position), [...updates.map(({ position }) => position), { x: 2, y: 0 }])
    for (const index of [0, 1]) assert.equal(after.viewGraph.concepts[index], after.graph.concepts[index])
    assert.equal(after.graph.concepts[2], before.graph.concepts[2])
    assert.equal(after.graph.relations, before.graph.relations)
    assert.equal(after.graph.relationTypes, before.graph.relationTypes)
    if (!subset) assert.equal(after.viewGraph, after.graph)
    else assert.deepEqual(after.viewGraph.concepts.map(({ id }) => id), ['urn:n1', 'urn:n2'])
    assert.deepEqual(before, snapshot)
    const published = structuredClone(after)
    rename.value = 'External mutation'
    updates[0].position.x = NaN
    assert.deepEqual(store.getState(), published)
    assert.equal(notifications, 1)
  }
})

test('batches can reference new concepts and types and reconcile navigation after deletion', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  const viewId = host.store.createView('All', ['urn:n1', 'urn:n2', 'urn:n3'])
  host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
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
  assert.deepEqual(state.selected, [])
  assert.deepEqual(state.viewGraph.concepts.map((concept) => concept.id), ['urn:n2', 'urn:n3', 'urn:n4', 'urn:n5'])
})

test('state batches share ordered graph, view and preference changes, including reset', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.registerVocab(vocabB)
  host.registerRenderer({ id: 'graph', component: () => null })
  host.registerTheme({ id: 'light', label: 'Light' })
  const { store } = host
  let notifications = 0
  store.subscribe(() => notifications++)
  store.applyOperations([
    { kind: 'view.create', id: 'urn:first', name: 'First', conceptIds: ['urn:n1'] },
    { kind: 'selection.set', value: [{ kind: 'concept', id: 'urn:n1' }] },
    { kind: 'preferences.vocab', id: vocabB.id },
    { kind: 'concept.add', id: 'urn:n4' },
    { kind: 'view.create', id: 'urn:second', name: 'Temporary', conceptIds: ['urn:n2'] },
    { kind: 'selection.set', value: [] },
    { kind: 'concept.add', id: 'urn:n5' },
    { kind: 'view.rename', id: 'urn:second', name: ' Second ' },
    { kind: 'view.membership', viewId: 'urn:second', conceptId: 'urn:n4', included: true },
    { kind: 'view.pin', id: 'urn:first', pinned: true },
    { kind: 'preferences.renderer', id: 'graph' },
    { kind: 'preferences.theme', id: 'light' },
    { kind: 'preferences.panels', value: { explorerWidth: 300, inspectorWidth: 350 } },
    { kind: 'preferences.section', id: 'sidebar.views', open: false },
    { kind: 'viewport.set', rendererId: 'graph', value: { x: 10, y: 20, zoom: 0.8 } },
    { kind: 'selection.set', value: [{ kind: 'concept', id: 'urn:n4' }] },
    { kind: 'view.activate', id: 'urn:first' },
  ])
  const state = store.getState()
  assert.equal(notifications, 1)
  assert.deepEqual(state.workspace.savedViews, [
    { id: 'urn:first', name: 'First', conceptIds: ['urn:n1', 'urn:n4'], pinned: true },
    { id: 'urn:second', name: 'Second', conceptIds: ['urn:n2', 'urn:n5', 'urn:n4'], pinned: false },
  ])
  assert.deepEqual(state.graph.relations.at(-1), { source: 'urn:n1', predicate: vocabB.defaultTypeId, target: 'urn:n4' })
  assert.deepEqual(state.viewGraph.concepts.map(({ id }) => id), ['urn:n1', 'urn:n4'])
  assert.deepEqual(state.selected, [{ kind: 'concept', id: 'urn:n4' }])
  assert.deepEqual(state.preferences.panels, { explorerWidth: 300, inspectorWidth: 350 })
  assert.deepEqual(state.preferences.collapsedSections, ['sidebar.views'])
  assert.deepEqual(state.workspace.viewports.graph, { x: 10, y: 20, zoom: 0.8 })
  store.applyOperations([
    { kind: 'document.reset', id: 'urn:fresh' },
    { kind: 'view.create', id: 'urn:fresh-view', name: 'Fresh', conceptIds: ['urn:fresh'] },
    { kind: 'selection.set', value: [{ kind: 'concept', id: 'urn:fresh' }] },
    { kind: 'concept.add', id: 'urn:child' },
  ])
  assert.equal(notifications, 2)
  assert.deepEqual(store.getState().graph.concepts.map(({ id }) => id), ['urn:fresh', 'urn:child'])
  assert.deepEqual(store.getState().workspace.savedViews, [{ id: 'urn:fresh-view', name: 'Fresh', conceptIds: ['urn:fresh', 'urn:child'], pinned: false }])
  assert.deepEqual(store.getState().workspace.viewports, {})
  assert.equal(store.getState().preferences, state.preferences)
})

test('invalid state batches reject every preceding change without notification', () => {
  const { store } = createNessoStore(fixture())
  const viewId = store.createView('Pair', ['urn:n1', 'urn:n2'])
  const before = store.getState()
  const snapshot = structuredClone(before)
  let notifications = 0
  store.subscribe(() => notifications++)
  const invalid: readonly NessoOperation[] = [
    { kind: 'view.rename', id: viewId, name: '' },
    { kind: 'view.create', id: viewId, name: 'Duplicate', conceptIds: [] },
    { kind: 'view.membership', viewId, conceptId: 'missing', included: true },
    { kind: 'preferences.panels', value: { explorerWidth: NaN, inspectorWidth: 300 } },
    { kind: 'preferences.renderer', id: 'missing' },
    { kind: 'preferences.locale', value: 'fr' as never },
    { kind: 'document.reset', id: '' },
    { kind: 'concept.position', id: 'urn:n1', value: { x: NaN, y: 0 } },
  ]
  for (const operation of invalid) {
    assert.throws(() => store.applyOperations([
      { kind: 'concept.label', id: 'urn:n1', value: 'Changed' },
      { kind: 'view.pin', id: viewId, pinned: true },
      { kind: 'preferences.section', id: 'sidebar', open: false },
      { kind: 'selection.set', value: [{ kind: 'concept', id: 'urn:n2' }] },
      operation,
    ]), (error: unknown) => (error instanceof SchemaError || error instanceof NessoError) && error.issues.length > 0)
    assert.equal(store.getState(), before)
    assert.deepEqual(before, snapshot)
  }
  assert.equal(notifications, 0)
})

test('empty and cancelling batches preserve state identity and do not notify', () => {
  const host = createNessoStore(fixture())
  host.registerVocab(vocabA)
  host.registerRenderer({ id: 'graph', component: () => null })
  const viewId = host.store.createView('Pair', ['urn:n1', 'urn:n2'])
  host.store.setViewport('graph', { x: 0, y: 0, zoom: 1 })
  host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
  const before = host.store.getState()
  const relation = { source: 'urn:n2', predicate: 'urn:links', target: 'urn:n3' }
  let notifications = 0
  host.store.subscribe(() => notifications++)
  host.store.applyOperations([])
  host.store.applyOperations([
    { kind: 'view.rename', id: viewId, name: '' },
    { kind: 'view.rename', id: viewId, name: 'Pair' },
    { kind: 'view.pin', id: viewId, pinned: true },
    { kind: 'view.pin', id: viewId, pinned: false },
    { kind: 'view.membership', viewId, conceptId: 'urn:n2', included: false },
    { kind: 'view.membership', viewId, conceptId: 'urn:n2', included: true },
    { kind: 'view.create', id: 'urn:temporary-view', name: 'Temporary', conceptIds: [] },
    { kind: 'view.remove', id: 'urn:temporary-view' },
    { kind: 'view.activate', id: viewId },
    { kind: 'viewport.set', rendererId: 'graph', value: { x: NaN, y: 10, zoom: 1 } },
    { kind: 'viewport.set', rendererId: 'graph', value: { x: 0, y: 0, zoom: 1 } },
    { kind: 'preferences.panels', value: { explorerWidth: NaN, inspectorWidth: 300 } },
    { kind: 'preferences.panels', value: before.preferences.panels },
    { kind: 'preferences.section', id: 'sidebar', open: false },
    { kind: 'preferences.section', id: 'sidebar', open: true },
    { kind: 'concept.label', id: 'urn:n1', value: 'Temporary' },
    { kind: 'concept.label', id: 'urn:n1', value: 'One' },
    { kind: 'concept.position', id: 'urn:n1', value: { x: NaN, y: 10 } },
    { kind: 'concept.position', id: 'urn:n1', value: { x: 0, y: 0 } },
    { kind: 'relation.connect', source: relation.source, target: relation.target },
    { kind: 'relation.remove', id: relationKey(relation) },
    { kind: 'relation.reconnect', id: relationKey(before.graph.relations[0]), source: 'urn:n2', target: 'urn:n3' },
    { kind: 'relation.reconnect', id: relationKey(relation), source: 'urn:n1', target: 'urn:n2' },
  ])
  assert.equal(host.store.getState(), before)
  assert.equal(notifications, 0)
  host.store.applyOperations([
    { kind: 'selection.set', value: [{ kind: 'concept', id: 'urn:n2' }] },
    { kind: 'concept.add', id: 'urn:temporary-concept' },
    { kind: 'concept.remove', id: 'urn:temporary-concept' },
  ])
  assert.deepEqual(host.store.getState().selected, [{ kind: 'concept', id: 'urn:n2' }])
  assert.equal(host.store.getState().graph, before.graph)
  assert.equal(host.store.getState().workspace, before.workspace)
  assert.equal(notifications, 1)
})

test('batches validate only the final document and link additions only to a surviving selection', () => {
  for (const empty of [false, true]) {
    const host = createNessoStore(fixture())
    host.registerVocab(vocabA)
    const removals = empty ? ['urn:n1', 'urn:n2', 'urn:n3'] : ['urn:n1', 'urn:n3']
    host.store.setSelection([{ kind: 'concept', id: 'urn:n2' }])
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
    assert.deepEqual(state.selected, [{ kind: 'concept', id: 'urn:n4' }])
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
    host.store.createView('Pair', ['urn:n1', 'urn:n2'])
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
  }
})

test('positions and multiple selections are owned, normalized and ignore no-ops', () => {
  const { store } = createNessoStore(fixture())
  const position = { x: 10, y: 20 }
  const id = store.addConcept(position)
  const relationId = relationKey(store.getState().graph.relations[0])
  const concept = { kind: 'concept' as const, id }
  const relation = { kind: 'relation' as const, id: relationId }
  const input = [concept, relation, concept, { kind: 'concept' as const, id: 'missing' }]
  let notifications = 0
  store.subscribe(() => notifications++)
  store.setSelection(input)
  const before = store.getState()
  assert.equal(notifications, 1)
  assert.deepEqual(before.selected, [concept, relation])
  position.x = NaN
  concept.id = 'missing'
  relation.id = 'missing'
  input.length = 0
  assert.deepEqual(before.graph.concepts.find((concept) => concept.id === id)?.position, { x: 10, y: 20 })
  assert.deepEqual(before.selected, [{ kind: 'concept', id }, { kind: 'relation', id: relationId }])
  store.setSelection([...before.selected, before.selected[0]])
  assert.equal(store.getState(), before)
  assert.equal(notifications, 1)
  store.setSelection([])
  const cleared = store.getState()
  store.setSelection([])
  assert.equal(store.getState(), cleared)
  assert.equal(notifications, 2)
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
    host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
    host.store.addConcept()
    const state = host.store.getState()
    assert.equal(state.preferences.activeVocabId, 'shared')
    assert.equal(state.vocabs[0].defaultTypeId, 'urn:shared-type')
    assert.deepEqual(state.graph.relationTypes.at(-1), { id: 'urn:shared-type', label: 'shared' })
    assert.notEqual(state.graph.relationTypes.at(-1), state.vocabs[0].relationTypes[0])
  }
  assert.notEqual(a.store.getState().vocabs[0], b.store.getState().vocabs[0])
  assert.notEqual(a.store.getState().vocabs[0].relationTypes[0], b.store.getState().vocabs[0].relationTypes[0])
  assert.notEqual(a.store.getState().graph.relationTypes.at(-1), b.store.getState().graph.relationTypes.at(-1))
})

test('position batches reject invalid coordinates atomically in every view mode', () => {
  for (const subset of [true, false]) {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const { store } = createNessoStore(fixture())
      if (subset) store.createView('Pair', ['urn:n1', 'urn:n2'])
      store.setSelection([{ kind: 'concept', id: 'urn:n2' }])
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
  const graph = fixture()
  graph.relationTypes.push({ id: 'urn:part', label: 'part' })
  graph.relations.push({ source: 'urn:n1', predicate: 'urn:part', target: 'urn:n2' })
  const { store, registerVocab } = createNessoStore(graph)
  registerVocab(vocabA)
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
  const id = relationKey(graph.relations[0])
  store.setRelationType(id, 'urn:part')
  store.connect('urn:n1', 'urn:n2')
  store.connect('urn:n1', 'urn:n1')
  assert.equal(store.getState(), before)
  assert.equal(notifications, 0)
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
    for (const id of ['graph', 'other']) host.registerRenderer({ id, component: () => null })
    for (const id of ['light', 'alternative']) host.registerTheme({ id })
    const state = host.store.getState()
    assert.equal(state.preferences.activeVocabId, missing ? 'a' : 'b')
    assert.equal(state.preferences.activeRendererId, missing ? 'graph' : 'other')
    assert.equal(state.preferences.activeThemeId, missing ? 'light' : 'alternative')
    assert.equal(state.viewGraph, state.graph)
    assert.deepEqual(state.selected, [])
    assert.deepEqual(state.graph, fixture())
  }
})

test('locale changes leave document data, selection and history untouched', () => {
  const host = createNessoStore(fixture())
  host.store.createView('Original view', ['urn:n1', 'urn:n2'])
  host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
  const before = host.store.getState()
  host.store.setLocale('it')
  const after = host.store.getState()
  assert.deepEqual(after, { ...before, preferences: { ...before.preferences, locale: 'it' } })
  for (const key of ['graph', 'workspace', 'viewGraph', 'selected', 'history'] as const) assert.equal(after[key], before[key])
  host.store.setLocale('it')
  assert.equal(host.store.getState(), after)
})

test('section preferences are global, immutable, validated and independent of the document', () => {
  const host = createNessoStore(fixture())
  host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
  const before = host.store.getState()
  let notifications = 0
  host.store.subscribe(() => notifications++)
  for (const id of sectionIds) {
    const previous = host.store.getState()
    host.store.setSectionOpen(id, true)
    assert.equal(host.store.getState(), previous)
    host.store.setSectionOpen(id, false)
    const closed = host.store.getState()
    assert.deepEqual(closed.preferences.collapsedSections, [id])
    assert.equal(closed.graph, before.graph)
    assert.equal(closed.workspace, before.workspace)
    assert.equal(closed.viewGraph, before.viewGraph)
    assert.equal(closed.selected, before.selected)
    assert.equal(previous.preferences.collapsedSections?.includes(id) ?? false, false)
    host.store.setSectionOpen(id, false)
    assert.equal(host.store.getState(), closed)
    host.store.setSectionOpen(id, true)
    assert.deepEqual(host.store.getState().preferences.collapsedSections, [])
    assert.deepEqual(closed.preferences.collapsedSections, [id])
  }
  assert.equal(notifications, sectionIds.length * 2)
  const collapsedSections: SectionId[] = ['sidebar', 'inspector.views']
  const restored = createNessoStore(fixture(), { preferences: { ...before.preferences, collapsedSections } })
  collapsedSections.push('inspector.nodes')
  assert.deepEqual(restored.store.getState().preferences.collapsedSections, ['sidebar', 'inspector.views'])
  const state = host.store.getState()
  assert.throws(() => host.store.setSectionOpen('missing' as SectionId, false), NessoError)
  assert.throws(() => host.store.setSectionOpen('sidebar', null as unknown as boolean), NessoError)
  assert.equal(host.store.getState(), state)
})

test('view renaming changes only the name and ignores no-ops', () => {
  const host = createNessoStore(fixture())
  const viewId = host.store.createView('Pair', ['urn:n1', 'urn:n2'])
  host.store.setViewPinned(viewId, true)
  host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
  const before = host.store.getState()
  host.store.renameView(viewId, '  Renamed pair  ')
  const after = host.store.getState()
  assert.deepEqual(after.workspace.savedViews[0], { ...before.workspace.savedViews[0], name: 'Renamed pair' })
  assert.deepEqual(after, { ...before, workspace: { ...before.workspace, savedViews: after.workspace.savedViews } })
  assert.equal(after.graph, before.graph)
  assert.equal(after.viewGraph, before.viewGraph)
  assert.equal(before.workspace.savedViews[0].name, 'Pair')
  host.store.renameView(viewId, ' Renamed pair ')
  assert.equal(host.store.getState(), after)
})

test('UI and viewport writes own their inputs, ignore no-ops and reject invalid changes atomically', () => {
  const host = createNessoStore(fixture())
  assert.deepEqual(host.store.getState().preferences.panels, { explorerWidth: 180, inspectorWidth: 210 })
  host.registerRenderer({ id: 'graph', component: () => null })
  const graph = host.store.getState().graph
  const conceptIds = ['urn:n1', 'urn:n2']
  const panels = { explorerWidth: 300, inspectorWidth: 350 }
  const viewport = { x: 100, y: -200, zoom: 0.8 }
  const viewId = host.store.createView('Pair', conceptIds)
  host.store.setPanelSizes(panels)
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
  host.store.setViewMembership(viewId, 'urn:n1', true)
  host.store.setViewPinned(viewId, false)
  host.store.setView(viewId)
  host.store.setPanelSizes({ explorerWidth: 300, inspectorWidth: 350 })
  host.store.setViewport('graph', { x: 100, y: -200, zoom: 0.8 })
  assert.equal(host.store.getState(), state)
  assert.equal(notifications, 0)
  const writes = [
    () => host.store.createView('', []),
    () => host.store.createView('x'.repeat(71), []),
    () => host.store.renameView(viewId, '   '),
    () => host.store.renameView(viewId, 'x'.repeat(71)),
    () => host.store.renameView('missing', 'Name'),
    () => host.store.createView('Invalid', ['missing']),
    () => host.store.setViewMembership(viewId, 'missing', true),
    () => host.store.deleteView('missing'),
    () => host.store.setPanelSizes({ explorerWidth: 500, inspectorWidth: 300 }),
    () => host.store.setPanelSizes({ explorerWidth: 179, inspectorWidth: 300 }),
    () => host.store.setPanelSizes({ explorerWidth: 300, inspectorWidth: 100 }),
    () => host.store.setViewport('missing', { x: 0, y: 0, zoom: 1 }),
    () => host.store.setViewport('graph', { x: Infinity, y: 0, zoom: 1 }),
    () => host.store.setViewport('graph', { x: 0, y: 0, zoom: 0 }),
  ]
  for (const write of writes) {
    assert.throws(write, (error: unknown) => error instanceof NessoError && error.issues.length > 0)
    assert.equal(host.store.getState(), state)
  }
  host.store.setPanelSizes({ explorerWidth: 180, inspectorWidth: 200 })
  assert.deepEqual(host.store.getState().preferences.panels, { explorerWidth: 180, inspectorWidth: 200 })
  host.store.setPanelSizes({ explorerWidth: 480, inspectorWidth: 200 })
  assert.equal(host.store.getState().preferences.panels.explorerWidth, 480)
  const longestView = host.store.createView('x'.repeat(70), [])
  assert.equal(host.store.getState().workspace.savedViews.find((view) => view.id === longestView)?.name.length, 70)
})

test('theme registration and activation are validated, isolated, and leave the document untouched', () => {
  const host = createNessoStore(fixture())
  const other = createNessoStore(fixture())
  const before = host.store.getState()
  const theme = { id: 'light' }
  host.registerTheme(theme)
  theme.id = 'Changed externally'
  assert.deepEqual(host.getTheme('light'), { id: 'light' })
  assert.deepEqual(other.listThemes(), [])
  assert.equal(other.store.getState().preferences.activeThemeId, '')
  host.registerTheme({ id: 'alternative' })
  assert.deepEqual(host.listThemes().map(({ id }) => id), ['light', 'alternative'])
  assert.equal(host.store.getState().preferences.activeThemeId, 'light')
  const snapshot = host.store.getState()
  let notifications = 0
  host.store.subscribe(() => notifications++)
  for (const invalid of [
    { id: 'light' },
    { id: '' },
    { id: ' ' },
  ]) {
    assert.throws(() => host.registerTheme(invalid), NessoError)
    assert.equal(host.store.getState(), snapshot)
  }
  assert.equal(host.getTheme('invalid'), undefined)
  assert.throws(() => host.store.setActiveTheme('missing'), (error: unknown) =>
    error instanceof NessoError && error.issues[0].path === 'preferences.activeThemeId')
  host.store.setActiveTheme('light')
  assert.equal(host.store.getState(), snapshot)
  assert.equal(notifications, 0)
  host.store.setActiveTheme('alternative')
  assert.equal(host.store.getState().preferences.activeThemeId, 'alternative')
  assert.equal(notifications, 1)
  assert.equal(host.store.getState().graph, before.graph)
  assert.equal(host.store.getState().workspace, before.workspace)
  assert.equal(host.store.getState().viewGraph, before.viewGraph)
})
