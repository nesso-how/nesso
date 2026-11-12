import assert from 'node:assert/strict'
import test from 'node:test'
import { creationSuggestions } from './creation.ts'

test('creation suggestions match outside labels, normalize accents and rank exact names first', () => {
  const graph = {
    concepts: [
      { id: 'urn:visible', label: 'Memory' },
      { id: 'urn:accent', label: 'Mémoire' },
      { id: 'urn:notes', label: 'Unrelated', notes: 'Notes-only match' },
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `urn:${index}`,
        label: `Memory ${index}`,
      })),
      { id: 'urn:exact', label: 'Memory' },
      { id: 'urn:tokens', label: 'Working memory' },
    ],
    relations: [],
    relationTypes: [],
  }
  const state = { graph, viewGraph: { ...graph, concepts: graph.concepts.slice(0, 1) } }
  assert.deepEqual(
    creationSuggestions(state, 'MEMOIRE').map(({ id }) => id),
    ['urn:accent'],
  )
  assert.deepEqual(
    creationSuggestions(state, 'memory').map(({ id }) => id),
    ['urn:exact', 'urn:0', 'urn:1', 'urn:2', 'urn:3'],
  )
  assert.deepEqual(
    creationSuggestions(state, 'memory working').map(({ id }) => id),
    ['urn:tokens'],
  )
  assert.deepEqual(creationSuggestions(state, '   '), [])
  assert.deepEqual(creationSuggestions(state, 'notes-only'), [])
  assert.deepEqual(creationSuggestions({ graph, viewGraph: graph }, 'memory'), [])
})
