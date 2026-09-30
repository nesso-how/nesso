import assert from 'node:assert/strict'
import test from 'node:test'
import type { VocabDefinition } from '@nesso/plugin'
import { relationKey, SchemaError, type Graph } from '@nesso/schema'
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
  host.store.setRelationType(id, 'part')
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
