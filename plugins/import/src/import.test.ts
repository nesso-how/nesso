import assert from 'node:assert/strict'
import test from 'node:test'
import type { Graph } from '@nesso-how/schema'
import { buildImportOperations } from './index.ts'

const snapshot: Graph = {
  concepts: [
    { id: 'urn:old-a', label: 'Alpha', description: 'Definition\nExample', position: { x: 1, y: 2 } },
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

test('import remaps concept ids and connects original types in the target view', () => {
  const operations = buildImportOperations(snapshot, 'urn:active', 'urn:target')
  const adds = operations.filter((operation) => operation.kind === 'concept.add')
  assert.equal(adds.length, 2)
  const ids = adds.map((operation) => operation.kind === 'concept.add' ? operation.id : '')
  assert.ok(ids.every((id) => !id.startsWith('urn:old-')))
  const labels = operations.filter((operation) => operation.kind === 'concept.label')
  assert.deepEqual(labels.map((operation) => operation.kind === 'concept.label' ? operation.value : ''), ['Alpha', 'Beta'])
  assert.deepEqual(operations.filter((operation) => operation.kind === 'concept.description'), [
    { kind: 'concept.description', id: ids[0], value: 'Definition\nExample' },
  ])
  const connects = operations.filter((operation) => operation.kind === 'relation.connect')
  assert.equal(connects.length, 3)
  assert.deepEqual(connects.map((operation) => operation.type?.id), ['urn:knows', 'urn:likes', 'urn:likes'])
  const joins = operations.filter((operation) => operation.kind === 'view.membership' && operation.viewId === 'urn:target')
  assert.equal(joins.length, 2)
  assert.ok(joins.every((operation) => operation.kind === 'view.membership' && operation.included))
  const leaves = operations.filter((operation) => operation.kind === 'view.membership' && operation.viewId === 'urn:active')
  assert.equal(leaves.length, 2)
  assert.ok(leaves.every((operation) => operation.kind === 'view.membership' && !operation.included))
})

test('import into the active view skips membership edits and empty snapshots are no-ops', () => {
  const same = buildImportOperations(snapshot, 'urn:active', 'urn:active')
  assert.ok(same.every((operation) => operation.kind !== 'view.membership'))
  assert.deepEqual(buildImportOperations({ concepts: [], relationTypes: [], relations: [] }, 'urn:active', null), [])
  const complete = buildImportOperations(snapshot, null, null)
  assert.ok(complete.every((operation) => operation.kind !== 'view.membership'))
})
