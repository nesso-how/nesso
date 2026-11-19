import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoOperation } from '@nesso-how/plugin'
import type { ConceptMap, Graph } from '@nesso-how/schema'
import { relationKey } from '@nesso-how/schema'
import { buildImportOperations, deriveMapName } from './index.ts'

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
const maps: ConceptMap[] = [
  {
    id: 'urn:old-map',
    name: '',
    members: [
      {
        id: 'urn:old-a',
        position: { x: 1, y: 2 },
        color: '#aabbcc',
        bold: true,
        italic: true,
        strikethrough: true,
      },
      { id: 'urn:old-b', position: { x: 3, y: 4 } },
    ],
    relationBends: [
      { source: 'urn:old-a', predicate: 'urn:knows', target: 'urn:old-b', bend: 0.25 },
    ],
  },
  { id: 'urn:other-map', name: 'Other', members: [{ id: 'urn:old-b', position: { x: 5, y: 6 } }] },
]

const conceptIds = (operations: readonly NessoOperation[]) =>
  operations.flatMap((operation) => (operation.kind === 'concept.add' ? [operation.id] : []))

test('import recreates file maps with presentation and remaps concept ids with original types', () => {
  const operations = buildImportOperations({ graph, maps }, 'urn:active', 'My map')
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
  const created = operations.filter((operation) => operation.kind === 'map.create')
  assert.deepEqual(
    created.map(({ name, conceptIds }) => [name, conceptIds]),
    [
      ['My map', []],
      ['Other', []],
    ],
  )
  assert.deepEqual(
    operations.filter((operation) => operation.kind === 'map.membership'),
    [
      { kind: 'map.membership', mapId: 'urn:active', conceptId: gamma, included: false },
      { kind: 'map.membership', mapId: created[1].id, conceptId: beta, included: true },
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
    ['concept.strikethrough', true],
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
  assert.deepEqual(
    operations.filter((operation) => operation.kind === 'relation.bend'),
    [
      {
        kind: 'relation.bend',
        id: relationKey({ source: alpha, predicate: 'urn:knows', target: beta }),
        value: 0.25,
      },
    ],
  )
  const bend = operations.findIndex(({ kind }) => kind === 'relation.bend')
  assert.ok(bend > operations.findIndex(({ kind }) => kind === 'relation.connect'))
  assert.ok(bend < operations.indexOf(created[1]))
  assert.deepEqual(operations.at(-1), { kind: 'selection.set', value: [] })
})

for (const activeMapId of [null, 'urn:active'])
  test(`graph-only files import without maps or layout from ${activeMapId ?? 'the graph'}`, () => {
    const operations = buildImportOperations({ graph, maps: [] }, activeMapId, 'My map')
    const ids = conceptIds(operations)
    assert.equal(ids.length, graph.concepts.length)
    assert.ok(ids.every((id) => !id.startsWith('urn:old-')))
    assert.deepEqual(
      operations
        .filter((operation) => operation.kind === 'concept.label')
        .map(({ value }) => value),
      graph.concepts.map(({ label }) => label),
    )
    assert.deepEqual(
      operations.filter((operation) => operation.kind === 'concept.notes'),
      [{ kind: 'concept.notes', id: ids[0], value: 'Definition\nExample' }],
    )
    assert.deepEqual(
      operations.filter((operation) => operation.kind === 'map.create'),
      [],
    )
    assert.deepEqual(
      operations
        .filter((operation) => operation.kind === 'concept.add')
        .map(({ position }) => position),
      [undefined, undefined, undefined],
    )
    assert.deepEqual(
      operations.filter((operation) => operation.kind === 'map.membership'),
      activeMapId === null
        ? []
        : ids.map((conceptId) => ({
            kind: 'map.membership',
            mapId: activeMapId,
            conceptId,
            included: false,
          })),
    )
    assert.deepEqual(
      operations.filter((operation) => operation.kind === 'relation.connect'),
      [
        { kind: 'relation.connect', source: ids[0], target: ids[1], type: graph.relationTypes[0] },
        { kind: 'relation.connect', source: ids[1], target: ids[0], type: graph.relationTypes[1] },
        { kind: 'relation.connect', source: ids[0], target: ids[1], type: graph.relationTypes[1] },
      ],
    )
    assert.deepEqual(operations.at(-1), { kind: 'selection.set', value: [] })
  })

test('empty snapshots are no-ops', () => {
  assert.deepEqual(
    buildImportOperations(
      { graph: { concepts: [], relationTypes: [], relations: [] }, maps: [] },
      'urn:map',
      'My map',
    ),
    [],
  )
})

test('map names derive from file names', () => {
  assert.equal(deriveMapName('nesso-my-map.jsonld'), 'My map')
  assert.equal(deriveMapName('Graph.json'), 'Graph')
  assert.equal(deriveMapName('nesso-Shopping_List.JSON'), 'Shopping List')
  assert.equal(deriveMapName('.json'), 'Import')
})
