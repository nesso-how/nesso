import assert from 'node:assert/strict'
import test from 'node:test'
import { relationKey, type Graph } from '@nesso-how/schema'
import { createNessoStore } from '../store/create.ts'
import { relationSelection, relationTypeOperations } from './relation-selection.ts'

const fixture = (): Graph => ({
  concepts: ['a', 'b', 'c'].map((id) => ({ id: `urn:${id}`, label: id })),
  relations: [
    { source: 'urn:a', predicate: 'urn:p', target: 'urn:b' },
    { source: 'urn:a', predicate: 'urn:p', target: 'urn:c' },
  ],
  relationTypes: [
    { id: 'urn:p', label: 'links' },
    { id: 'urn:q', label: 'other' },
  ],
})

test('unified editing requires only relations with a common predicate and endpoint', () => {
  const graph = fixture()
  const selected = graph.relations.map((edge) => ({
    kind: 'relation' as const,
    id: relationKey(edge),
  }))
  assert.equal(relationSelection(graph, selected).length, 2)
  assert.equal(relationSelection(graph, [...selected, { kind: 'concept', id: 'urn:a' }]).length, 0)
  const incoming = {
    ...graph,
    relations: graph.relations.map(({ source, target, predicate }) => ({
      source: target,
      target: source,
      predicate,
    })),
  }
  assert.equal(
    relationSelection(
      incoming,
      incoming.relations.map((edge) => ({ kind: 'relation', id: relationKey(edge) })),
    ).length,
    2,
  )
  const unrelated = {
    ...graph,
    relations: [graph.relations[0], { ...graph.relations[1], source: 'urn:b' }],
  }
  assert.deepEqual(
    relationSelection(
      unrelated,
      unrelated.relations.map((edge) => ({ kind: 'relation', id: relationKey(edge) })),
    ),
    [],
  )
  graph.relations[1].predicate = 'urn:q'
  assert.equal(
    relationSelection(
      graph,
      graph.relations.map((edge) => ({ kind: 'relation', id: relationKey(edge) })),
    ).length,
    0,
  )
})

test('bulk retyping creates one type, publishes once, retains selection and undoes together', () => {
  const graph = fixture()
  const { store } = createNessoStore(graph)
  store.setSelection(graph.relations.map((edge) => ({ kind: 'relation', id: relationKey(edge) })))
  let publications = 0
  store.subscribe(() => publications++)
  store.applyOperations(relationTypeOperations(graph.relations, { label: 'new type' }))
  assert.equal(publications, 1)
  const changed = store.getState().graph
  assert.equal(changed.relationTypes.filter(({ label }) => label === 'new type').length, 1)
  assert.equal(new Set(changed.relations.map(({ predicate }) => predicate)).size, 1)
  assert.equal(store.getState().selected.length, 2)
  store.undo()
  assert.deepEqual(store.getState().graph, graph)
  assert.equal(store.getState().history.canUndo, false)
})
