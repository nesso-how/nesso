import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoOperation } from '@nesso-how/plugin'
import type { Graph, View } from '@nesso-how/schema'
import { buildImportOperations, deriveViewName } from './index.ts'

const graph: Graph = {
  concepts: [
    { id: 'urn:old-a', label: 'Alpha', notes: 'Definition\nExample' },
    { id: 'urn:old-b', label: 'Beta' },
    { id: 'urn:old-c', label: 'Gamma' },
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
const views: View[] = [
  {
    id: 'urn:old-view',
    name: '',
    members: [
      { id: 'urn:old-a', position: { x: 1, y: 2 }, color: '#aabbcc', bold: true, italic: true },
      { id: 'urn:old-b', position: { x: 3, y: 4 } },
    ],
  },
  { id: 'urn:other-view', name: 'Other', members: [{ id: 'urn:old-b', position: { x: 5, y: 6 } }] },
]

const conceptIds = (operations: readonly NessoOperation[]) =>
  operations.flatMap((operation) => (operation.kind === 'concept.add' ? [operation.id] : []))

test('import recreates file views with presentation and remaps concept ids with original types', () => {
  const operations = buildImportOperations({ graph, views }, 'urn:active', 'My view')
  const ids = conceptIds(operations)
  assert.equal(ids.length, 3)
  assert.ok(ids.every((id) => !id.startsWith('urn:old-')))
  const [gamma, alpha, beta] = ids
  assert.deepEqual(
    operations.filter((operation) => operation.kind === 'concept.label').map(({ id }) => id),
    [gamma, alpha, beta],
  )
  assert.deepEqual(
    operations.filter((operation) => operation.kind === 'concept.notes'),
    [{ kind: 'concept.notes', id: alpha, value: 'Definition\nExample' }],
  )
  const created = operations.filter((operation) => operation.kind === 'view.create')
  assert.deepEqual(
    created.map(({ name, conceptIds }) => [name, conceptIds]),
    [
      ['My view', []],
      ['Other', []],
    ],
  )
  assert.deepEqual(
    operations.filter((operation) => operation.kind === 'view.membership'),
    [
      { kind: 'view.membership', viewId: 'urn:active', conceptId: gamma, included: false },
      { kind: 'view.membership', viewId: created[1].id, conceptId: beta, included: true },
    ],
  )
  assert.deepEqual(
    operations
      .filter((operation) => operation.kind === 'concept.add')
      .map(({ position }) => position),
    [undefined, { x: 1, y: 2 }, { x: 3, y: 4 }],
  )
  assert.deepEqual(
    operations.filter((operation) => operation.kind === 'concept.position'),
    [{ kind: 'concept.position', id: beta, value: { x: 5, y: 6 } }],
  )
  for (const [kind, value] of [
    ['concept.color', '#aabbcc'],
    ['concept.bold', true],
    ['concept.italic', true],
  ] as const)
    assert.deepEqual(
      operations.filter((operation) => operation.kind === kind),
      [{ kind, id: alpha, value }],
    )
  const connects = operations.filter((operation) => operation.kind === 'relation.connect')
  assert.deepEqual(
    connects.map((operation) => operation.type?.id),
    ['urn:knows', 'urn:likes', 'urn:likes'],
  )
  assert.deepEqual(operations.at(-1), { kind: 'selection.set', value: [] })
})

test('graph-only files open a new view with every concept laid out on a grid', () => {
  const operations = buildImportOperations({ graph, views: [] }, 'urn:active', 'My view')
  assert.deepEqual(
    operations
      .filter((operation) => operation.kind === 'view.create')
      .map(({ name, conceptIds }) => [name, conceptIds]),
    [['My view', []]],
  )
  assert.deepEqual(
    operations
      .filter((operation) => operation.kind === 'concept.add')
      .map(({ position }) => position),
    [
      { x: 0, y: 0 },
      { x: 240, y: 0 },
      { x: 0, y: 120 },
    ],
  )
})

test('empty snapshots are no-ops', () => {
  assert.deepEqual(
    buildImportOperations(
      { graph: { concepts: [], relationTypes: [], relations: [] }, views: [] },
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
