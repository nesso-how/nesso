import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGraph, relationKey, SchemaError, type Graph } from '@nesso/schema'
import { copyGraph, pasteOperations } from './clipboard.ts'

const graph: Graph = {
  concepts: [
    { id: 'urn:a', label: 'Alpha', position: { x: 10, y: 20 } },
    { id: 'urn:b', label: 'Beta', position: { x: 110, y: 70 } },
    { id: 'urn:c', label: 'Gamma', position: { x: 210, y: 120 } },
  ],
  relationTypes: [{ id: 'urn:links', label: 'Links' }, { id: 'urn:unused', label: 'Unused' }],
  relations: [
    { source: 'urn:a', predicate: 'urn:links', target: 'urn:b' },
    { source: 'urn:b', predicate: 'urn:links', target: 'urn:c' },
  ],
}

test('copy includes internal relations or selected relation endpoints, but not unrelated items', () => {
  const selection = [{ kind: 'concept' as const, id: 'urn:a' }, { kind: 'concept' as const, id: 'urn:b' }]
  const text = copyGraph(graph, selection)!
  const copied = parseGraph(JSON.parse(text))
  assert.deepEqual(copied, {
    concepts: graph.concepts.slice(0, 2),
    relationTypes: graph.relationTypes.slice(0, 1),
    relations: graph.relations.slice(0, 1),
  })
  assert.equal(copyGraph(graph, [{ kind: 'relation', id: relationKey(graph.relations[0]) }]), text)
  assert.equal(copyGraph(graph, []), null)
  assert.deepEqual(parseGraph(JSON.parse(copyGraph(graph, [selection[0]])!)).relations, [])
})

test('paste positions the group at the requested point and rejects non-JSON clipboard data', () => {
  const text = copyGraph(graph, [{ kind: 'relation', id: relationKey(graph.relations[0]) }])!
  const additions = pasteOperations(text, { x: 500, y: 600 }).filter((operation) => operation.kind === 'concept.add')
  assert.deepEqual(additions.map((operation) => operation.position), [{ x: 500, y: 600 }, { x: 600, y: 650 }])
  assert.throws(() => pasteOperations('not a graph'), SchemaError)
})
