import assert from 'node:assert/strict'
import test from 'node:test'
import type { ViewGraphSnapshot } from '@nesso-how/core'
import { parseGraph, relationKey, SchemaError } from '@nesso-how/schema'
import { copyGraph, pasteOperations, selectionCoversGraph } from './commands.ts'

const graph: ViewGraphSnapshot = {
  concepts: [
    { id: 'urn:a', label: 'Alpha', position: { x: 10, y: 20 }, color: '#ffeeee' },
    { id: 'urn:b', label: 'Beta', position: { x: 110, y: 70 } },
    { id: 'urn:c', label: 'Gamma', position: { x: 210, y: 120 } },
  ],
  relationTypes: [
    { id: 'urn:links', label: 'Links' },
    { id: 'urn:unused', label: 'Unused' },
  ],
  relations: [
    { source: 'urn:a', predicate: 'urn:links', target: 'urn:b' },
    { source: 'urn:b', predicate: 'urn:links', target: 'urn:c' },
  ],
}

test('copy includes internal relations or selected relation endpoints, but not unrelated items', () => {
  const selection = [
    { kind: 'concept' as const, id: 'urn:a' },
    { kind: 'concept' as const, id: 'urn:b' },
  ]
  const text = copyGraph(graph, selection)!
  const { graph: copied, views } = parseGraph(JSON.parse(text))
  assert.deepEqual(copied, {
    concepts: graph.concepts.slice(0, 2).map(({ id, label }) => ({ id, label })),
    relationTypes: graph.relationTypes.slice(0, 1),
    relations: graph.relations.slice(0, 1),
  })
  assert.deepEqual(views[0].members, [
    { id: 'urn:a', position: { x: 10, y: 20 }, color: '#ffeeee' },
    { id: 'urn:b', position: { x: 110, y: 70 } },
  ])
  const read = (value: string) => {
    const { graph, views } = parseGraph(JSON.parse(value))
    return { graph, members: views.map(({ members }) => members) }
  }
  assert.deepEqual(
    read(copyGraph(graph, [{ kind: 'relation', id: relationKey(graph.relations[0]) }])!),
    read(text),
  )
  assert.equal(copyGraph(graph, []), null)
  assert.deepEqual(parseGraph(JSON.parse(copyGraph(graph, [selection[0]])!)).graph.relations, [])
  const overview = { ...graph, concepts: graph.concepts.map(({ id, label }) => ({ id, label })) }
  assert.deepEqual(parseGraph(JSON.parse(copyGraph(overview, selection)!)).views, [])
})

test('paste positions the group at the requested point and rejects non-JSON clipboard data', () => {
  const text = copyGraph(graph, [{ kind: 'relation', id: relationKey(graph.relations[0]) }])!
  const additions = pasteOperations(text, { x: 500, y: 600 }).filter(
    (operation) => operation.kind === 'concept.add',
  )
  assert.deepEqual(
    additions.map((operation) => operation.position),
    [
      { x: 500, y: 600 },
      { x: 600, y: 650 },
    ],
  )
  const pasted = pasteOperations(text)
  const [added] = pasted.flatMap((operation) =>
    operation.kind === 'concept.add' ? [operation.id] : [],
  )
  assert.deepEqual(
    pasted.filter((operation) => operation.kind === 'concept.color'),
    [{ kind: 'concept.color', id: added, value: '#ffeeee' }],
  )
  assert.equal(
    pasteOperations(text, undefined, 40, false).some(
      (operation) =>
        operation.kind === 'concept.color' ||
        (operation.kind === 'concept.add' && operation.position !== undefined),
    ),
    false,
  )
  assert.throws(() => pasteOperations('not a graph'), SchemaError)
})

test('deletion covers every visible concept regardless of relations or off-view selections', () => {
  const view = { ...graph, concepts: graph.concepts.slice(0, 2) }
  const selected = view.concepts.map(({ id }) => ({ kind: 'concept' as const, id }))
  assert.equal(selectionCoversGraph(selected, view), true)
  assert.equal(
    selectionCoversGraph(
      [...selected, { kind: 'relation', id: 'edge' }, { kind: 'concept', id: 'urn:c' }],
      view,
    ),
    true,
  )
  assert.equal(selectionCoversGraph([selected[0], { kind: 'concept', id: 'urn:c' }], view), false)
  assert.equal(selectionCoversGraph([selected[0], { kind: 'relation', id: 'urn:b' }], view), false)
  assert.equal(selectionCoversGraph([], view), false)
  assert.equal(selectionCoversGraph(selected, { ...view, concepts: [] }), false)
})
