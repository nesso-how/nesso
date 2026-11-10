import assert from 'node:assert/strict'
import test from 'node:test'
import type { Graph } from '@nesso-how/schema'
import { buildImportOperations, deriveViewName } from './index.ts'

const snapshot: Graph = {
  concepts: [
    {
      id: 'urn:old-a',
      label: 'Alpha',
      notes: 'Definition\nExample',
      color: '#aabbcc',
      bold: true,
      italic: true,
      position: { x: 1, y: 2 },
    },
    { id: 'urn:old-b', label: 'Beta', position: { x: 3, y: 4 } },
  ],
  relationTypes: [
    { id: 'urn:knows', label: 'knows' },
    { id: 'urn:likes', label: 'likes' },
  ],
  relations: [
    { source: 'urn:old-a', predicate: 'urn:knows', target: 'urn:old-b' },
    { source: 'urn:old-b', predicate: 'urn:likes', target: 'urn:old-a' },
    { source: 'urn:old-a', predicate: 'urn:likes', target: 'urn:old-b' },
    { source: 'urn:old-a', predicate: 'urn:missing', target: 'urn:old-b' },
    { source: 'urn:old-a', predicate: 'urn:knows', target: 'urn:ghost' },
    { source: 'urn:old-a', predicate: 'urn:knows', target: 'urn:old-a' },
  ],
}

test('import creates a new view and remaps concept ids with original types', () => {
  const operations = buildImportOperations(snapshot, 'urn:view', 'My view')
  assert.deepEqual(operations[0], {
    kind: 'view.create',
    id: 'urn:view',
    name: 'My view',
    conceptIds: [],
  })
  const adds = operations.filter((operation) => operation.kind === 'concept.add')
  assert.equal(adds.length, 2)
  const ids = adds.map((operation) => (operation.kind === 'concept.add' ? operation.id : ''))
  assert.ok(ids.every((id) => !id.startsWith('urn:old-')))
  const labels = operations.filter((operation) => operation.kind === 'concept.label')
  assert.deepEqual(
    labels.map((operation) => (operation.kind === 'concept.label' ? operation.value : '')),
    ['Alpha', 'Beta'],
  )
  assert.deepEqual(
    operations.filter((operation) => operation.kind === 'concept.notes'),
    [{ kind: 'concept.notes', id: ids[0], value: 'Definition\nExample' }],
  )
  const connects = operations.filter((operation) => operation.kind === 'relation.connect')
  for (const [kind, value] of [
    ['concept.color', '#aabbcc'],
    ['concept.bold', true],
    ['concept.italic', true],
  ] as const)
    assert.deepEqual(
      operations.filter((operation) => operation.kind === kind),
      [{ kind, id: ids[0], value }],
    )
  assert.equal(connects.length, 3)
  assert.deepEqual(
    connects.map((operation) => operation.type?.id),
    ['urn:knows', 'urn:likes', 'urn:likes'],
  )
  assert.ok(operations.every((operation) => operation.kind !== 'view.membership'))
  assert.deepEqual(operations.at(-1), { kind: 'selection.set', value: [] })
})

test('empty snapshots are no-ops', () => {
  assert.deepEqual(
    buildImportOperations(
      { concepts: [], relationTypes: [], relations: [] },
      'urn:view',
      'My view',
    ),
    [],
  )
})

test('view names derive from file names', () => {
  assert.equal(deriveViewName('nesso-my-view.jsonld'), 'My view')
  assert.equal(deriveViewName('Graph.json'), 'Graph')
  assert.equal(deriveViewName('nesso-Shopping_List.JSON'), 'Shopping List')
  assert.equal(deriveViewName('.json'), 'Import')
})
